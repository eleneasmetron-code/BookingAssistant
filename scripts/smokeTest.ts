import { addDays, format } from "date-fns";
import { appContainer } from "../src/app/container.js";
import { AppointmentSource } from "../src/domain/statuses.js";
import { getLocalDayOfWeek, toLocalDateKey, toHumanTime } from "../src/utils/dateTime.js";

const findSlot = async (serviceId?: string) => {
  const services = await appContainer.serviceCatalog.listActive();
  const service = serviceId
    ? services.find((item) => item.id === serviceId)
    : services.find((item) => item.name.includes("массаж")) ?? services[0];
  if (!service) {
    throw new Error("Нет активных услуг для проверки");
  }

  for (let offset = 0; offset < 14; offset += 1) {
    const date = format(addDays(new Date(), offset), "yyyy-MM-dd");
    const slots = await appContainer.slotService.findSlots({ serviceId: service.id, date, limit: 1 });
    if (slots[0]) {
      return slots[0];
    }
  }

  throw new Error("Не найден свободный слот для проверки");
};

const slot = await findSlot();
const smokeService = await appContainer.serviceCatalog.getById(slot.serviceId);

const smokeSpecialist = await appContainer.prisma.specialist.upsert({
  where: { name: "Николай Орлов" },
  create: {
    name: "Николай Орлов",
    position: "массажист",
    adminComment: "Демо-специалист для автоматической проверки",
    isActive: true
  },
  update: {
    position: "массажист",
    adminComment: "Демо-специалист для автоматической проверки",
    isActive: true
  }
});

await appContainer.specialistService.assignService(smokeSpecialist.id, smokeService.id);
await appContainer.specialistService.addWorkingHour({
  specialistId: smokeSpecialist.id,
  dayOfWeek: getLocalDayOfWeek(toLocalDateKey(slot.startAt, appContainer.config.timezone), appContainer.config.timezone),
  startTime: "10:00",
  endTime: "22:00"
});

const smokeSpecialistSlots = await appContainer.slotService.findSlots({
  serviceId: smokeService.id,
  date: toLocalDateKey(slot.startAt, appContainer.config.timezone),
  specialistId: smokeSpecialist.id,
  limit: 1
});

if (smokeSpecialistSlots.length === 0) {
  throw new Error("После назначения услуги специалисту свободные окна не появились");
}

const created = await appContainer.bookingService.createAppointment({
  clientName: "Алексей Морозов",
  clientPhone: "+79990009999",
  telegramId: "999999999",
  serviceId: slot.serviceId,
  specialistId: slot.specialistId,
  startAt: slot.startAt,
  source: AppointmentSource.TelegramBot,
  comment: "демо-запись"
});

let duplicateBlocked = false;

try {
  await appContainer.bookingService.createAppointment({
    clientName: "Павел Соколов",
    clientPhone: "+79990008888",
    telegramId: "999999998",
    serviceId: slot.serviceId,
    specialistId: slot.specialistId,
    startAt: slot.startAt,
    source: AppointmentSource.TelegramBot,
    comment: "демо-запись дубля"
  });
} catch {
  duplicateBlocked = true;
}

const newSlot = await findSlot(slot.serviceId);
const moved = await appContainer.bookingService.rescheduleAppointment(
  created.id,
  newSlot.specialistId,
  newSlot.startAt,
  "admin"
);

const blockDate = toLocalDateKey(newSlot.startAt, appContainer.config.timezone);
const blockStart = toHumanTime(newSlot.startAt, appContainer.config.timezone);
const blockEnd = toHumanTime(newSlot.endAt, appContainer.config.timezone);
await appContainer.specialistService.addTimeBlock({
  specialistId: newSlot.specialistId,
  date: blockDate,
  startTime: blockStart,
  endTime: blockEnd,
  reason: "служебное окно",
  createdBy: "администратор"
});

const slotsAfterBlock = await appContainer.slotService.findSlots({
  serviceId: newSlot.serviceId,
  date: blockDate,
  specialistId: newSlot.specialistId,
  limit: 50
});
const blockedStillShown = slotsAfterBlock.some(
  (item) => item.startAt.getTime() === newSlot.startAt.getTime()
);

await appContainer.bookingService.cancelAppointment(moved.id, "admin", true);
await appContainer.prisma.$disconnect();

if (!duplicateBlocked) {
  throw new Error("Двойная запись не заблокирована");
}

if (blockedStillShown) {
  throw new Error("Заблокированное время всё ещё показывается в свободных окнах");
}

console.log(
  "Smoke test ok: запись создана, дубль заблокирован, перенос работает, блокировка скрывает слот, тестовая запись отменена."
);
