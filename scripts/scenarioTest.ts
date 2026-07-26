import { addDays, addMinutes, format } from "date-fns";
import { appContainer } from "../src/app/container.js";
import { LateCancelNeedsAdminError } from "../src/domain/errors.js";
import {
  AppointmentSource,
  AppointmentStatus,
  ConversationStep,
  IntentType
} from "../src/domain/statuses.js";

const fail = (message: string): never => {
  throw new Error(message);
};

const findFutureSlot = async (minOffsetDays: number) => {
  const services = await appContainer.serviceCatalog.listActive();

  for (const service of services) {
    for (let offset = minOffsetDays; offset < minOffsetDays + 30; offset += 1) {
      const date = format(addDays(new Date(), offset), "yyyy-MM-dd");
      const [slot] = await appContainer.slotService.findSlots({
        serviceId: service.id,
        date,
        limit: 1
      });

      if (slot) {
        return slot;
      }
    }
  }

  fail("Не найден свободный слот для сценарной проверки");
};

const assertIntent = async (text: string, type: string) => {
  const parsed = await appContainer.intentService.parse(text);
  if (parsed.type !== type) {
    fail(`Неверное намерение для "${text}": ожидалось ${type}, получено ${parsed.type}`);
  }

  return parsed;
};

const normalCancelSlot = await findFutureSlot(3);
const normalAppointment = await appContainer.bookingService.createAppointment({
  clientName: "Елена Кузнецова",
  clientPhone: "+79990007001",
  telegramId: `9007001${Date.now()}`,
  serviceId: normalCancelSlot.serviceId,
  specialistId: normalCancelSlot.specialistId,
  startAt: normalCancelSlot.startAt,
  source: AppointmentSource.TelegramBot,
  comment: "scenario-test-cancel"
});

const canceled = await appContainer.bookingService.cancelAppointment(normalAppointment.id, "client");
if (canceled.status !== AppointmentStatus.Canceled) {
  fail("Обычная отмена не перевела запись в статус canceled");
}

const statusSlot = await findFutureSlot(4);
const statusAppointment = await appContainer.bookingService.createAppointment({
  clientName: "Оксана Петрова",
  clientPhone: "+79990007002",
  telegramId: `9007002${Date.now()}`,
  serviceId: statusSlot.serviceId,
  specialistId: statusSlot.specialistId,
  startAt: statusSlot.startAt,
  source: AppointmentSource.Manual,
  comment: "scenario-test-status"
});

const completed = await appContainer.bookingService.updateAppointmentStatus(
  statusAppointment.id,
  AppointmentStatus.Completed
);
if (completed.status !== AppointmentStatus.Completed) {
  fail("Статус 'пришёл' не сохранился как completed");
}

const noShow = await appContainer.bookingService.updateAppointmentStatus(
  statusAppointment.id,
  AppointmentStatus.NoShow
);
if (noShow.status !== AppointmentStatus.NoShow) {
  fail("Статус 'не пришёл' не сохранился как no_show");
}

const statusClientByPhone = await appContainer.clientService.findByPhone("+79990007002");
if (!statusClientByPhone) {
  fail("Клиент не находится по телефону после создания записи");
}

const statusClientByTelegram = await appContainer.clientService.findByTelegramId(
  statusAppointment.client.telegramId ?? ""
);
if (!statusClientByTelegram) {
  fail("Клиент не находится по Telegram ID после создания записи");
}

const services = await appContainer.serviceCatalog.listActive();
const service = services[0] ?? fail("Нет активных услуг для сценарной проверки");
const specialists = await appContainer.specialistService.findByService(service.id);
const specialist = specialists[0] ?? fail("Нет специалиста для сценарной проверки");
const lateTelegramId = `9007003${Date.now()}`;
const lateClient = await appContainer.prisma.client.upsert({
  where: { telegramId: lateTelegramId },
  create: {
    name: "Наталья Васильева",
    phone: "+79990007003",
    telegramId: lateTelegramId,
    firstVisitAt: new Date()
  },
  update: {}
});
const lateStartAt = addMinutes(new Date(), 60);
const lateAppointment = await appContainer.prisma.appointment.create({
  data: {
    clientId: lateClient.id,
    serviceId: service.id,
    specialistId: specialist.id,
    startAt: lateStartAt,
    endAt: addMinutes(lateStartAt, service.durationMinutes),
    status: AppointmentStatus.Confirmed,
    source: AppointmentSource.Manual,
    clientNameSnapshot: lateClient.name,
    clientPhoneSnapshot: lateClient.phone,
    comment: "scenario-test-late-cancel"
  }
});

let lateCancelBlocked = false;
try {
  await appContainer.bookingService.cancelAppointment(lateAppointment.id, "client");
} catch (error) {
  lateCancelBlocked = error instanceof LateCancelNeedsAdminError;
}

if (!lateCancelBlocked) {
  fail("Поздняя отмена не была передана администратору");
}

await appContainer.bookingService.cancelAppointment(lateAppointment.id, "admin", true);

await assertIntent("Сколько стоит чистка лица?", IntentType.PriceQuestion);
await assertIntent("Мне стало плохо после процедуры, что делать?", IntentType.Complaint);
await assertIntent("Есть противопоказания при беременности?", IntentType.MedicalQuestion);
await assertIntent("Позовите администратора", IntentType.AdminRequest);
const bookingIntent = await assertIntent("Хочу завтра после 18 на массаж спины", IntentType.Booking);
if (!bookingIntent.serviceName || !bookingIntent.dateText || !bookingIntent.periodText) {
  fail("Запись свободным текстом не извлекла услугу, дату или период");
}

await appContainer.serviceCatalog.update(service.id, { isActive: false });
try {
  const activeAfterDisable = await appContainer.serviceCatalog.listActive();
  if (activeAfterDisable.some((item) => item.id === service.id)) {
    fail("Выключенная услуга осталась в списке активных услуг");
  }

  const disabledServiceSlots = await appContainer.slotService.findSlots({
    serviceId: service.id,
    date: format(addDays(new Date(), 3), "yyyy-MM-dd"),
    limit: 1
  });
  if (disabledServiceSlots.length > 0) {
    fail("Выключенная услуга всё ещё показывает свободные окна");
  }
} finally {
  await appContainer.serviceCatalog.update(service.id, { isActive: true });
}

const conversationTelegramId = `scenario-conversation-${Date.now()}`;
await appContainer.conversationService.saveState({
  telegramId: conversationTelegramId,
  step: ConversationStep.ChoosingTime,
  selectedServiceId: service.id,
  selectedDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
  clientName: "Виктория Смирнова",
  data: { check: true }
});
await appContainer.conversationService.addClientMessage(
  conversationTelegramId,
  "Хочу записаться",
  "scenario-test"
);
await appContainer.conversationService.addBotMessage(
  conversationTelegramId,
  "Показываю свободное время",
  "scenario-test"
);
const savedConversation = await appContainer.conversationService.getState(conversationTelegramId);
if (savedConversation?.step !== ConversationStep.ChoosingTime) {
  fail("Состояние диалога не сохранилось");
}
await appContainer.conversationService.reset(conversationTelegramId);
const resetConversation = await appContainer.conversationService.getState(conversationTelegramId);
if (resetConversation?.step !== ConversationStep.Idle) {
  fail("Состояние диалога не сбросилось");
}

const oldAddress = await appContainer.settingsService.get("studio_address");
const testAddress = `Тестовый адрес ${Date.now()}`;
await appContainer.settingsService.update("studio_address", testAddress);
const savedAddress = await appContainer.settingsService.get("studio_address");
if (savedAddress !== testAddress) {
  fail("Настройка адреса не сохранилась");
}
await appContainer.settingsService.update("studio_address", oldAddress);

const reminderSlot = await findFutureSlot(5);
await appContainer.bookingService.createAppointment({
  clientName: "Мария Иванова",
  clientPhone: "+79990007004",
  telegramId: `9007004${Date.now()}`,
  serviceId: reminderSlot.serviceId,
  specialistId: reminderSlot.specialistId,
  startAt: reminderSlot.startAt,
  source: AppointmentSource.TelegramBot,
  comment: "scenario-test-reminder"
});

const reminderResult = await appContainer.reminderService.sendNextPlannedForTest();
if (!reminderResult.sent) {
  fail(`Тестовое напоминание не отправлено: ${reminderResult.message}`);
}

await appContainer.prisma.$disconnect();

console.log(
  "Scenario test ok: отмена, поздняя отмена, статусы, намерения, настройки и тестовое напоминание работают."
);
