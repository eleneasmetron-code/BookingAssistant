import { Markup, Telegraf } from "telegraf";
import type { Context } from "telegraf";
import type { appContainer } from "../app/container.js";
import { getUserMessage } from "../domain/errors.js";
import { AppointmentSource, ConversationStep, IntentType } from "../domain/statuses.js";
import type { SlotOption } from "../domain/types.js";
import { dateKeyFromText, toHumanDate, toHumanDateTime, toHumanTime, todayKey } from "../utils/dateTime.js";

type Container = typeof appContainer;

interface StateData {
  slots?: Array<Omit<SlotOption, "startAt" | "endAt"> & { startAt: string; endAt: string }>;
  appointmentId?: string;
}

const mainKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback("Записаться", "main_booking")],
    [Markup.button.callback("Посмотреть услуги", "main_services")],
    [Markup.button.callback("Мои записи", "my_appointments")],
    [Markup.button.callback("Позвать администратора", "admin_request")]
  ]);

const dateKeyboard = (prefix: "date" | "rsdate", timezone: string) => {
  const today = todayKey(timezone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const items = [0, 1, 2].map((offset) => {
    const date = new Date(todayDate);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    const label = offset === 0 ? "Сегодня" : offset === 1 ? "Завтра" : toHumanDate(date, timezone);
    return Markup.button.callback(label, `${prefix}:${key}`);
  });

  return Markup.inlineKeyboard([items, [Markup.button.callback("Назад", "back_main")]]);
};

const getTelegramId = (ctx: Context): string | null => {
  const id = ctx.from?.id;
  return id ? String(id) : null;
};

const getText = (ctx: Context): string | null => {
  const message = ctx.message;
  if (message && "text" in message) {
    return message.text;
  }
  return null;
};

const getMatch = (ctx: Context): string | undefined => {
  const match = "match" in ctx ? (ctx.match as RegExpExecArray | undefined) : undefined;
  return match?.[1];
};

const parsePhone = (text: string): string | undefined => {
  const match = text.match(/(?:\+?7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
  return match?.[0]?.replace(/[^\d+]/g, "");
};

const removePhone = (text: string, phone?: string): string => {
  if (!phone) {
    return text.trim();
  }

  return text.replace(/[+\d\s()/-]{8,}/g, "").trim().replace(/[,.;]+$/, "").trim();
};

export const createTelegramBot = (container: Container) => {
  const bot = new Telegraf(container.config.telegramBotToken);

  const replyAndLog = async (ctx: Context, text: string, keyboard?: ReturnType<typeof Markup.inlineKeyboard>) => {
    const telegramId = getTelegramId(ctx);
    if (telegramId) {
      await container.conversationService.addBotMessage(telegramId, text);
    }
    await ctx.reply(text, keyboard);
  };

  const showServices = async (ctx: Context, mode: "booking" | "view" = "booking") => {
    const services = await container.serviceCatalog.listActive();
    const rows = services.map((service) => [
      Markup.button.callback(
        `${service.name} · ${service.durationMinutes} мин · ${service.price} руб.`,
        mode === "booking" ? `service:${service.id}` : `service_info:${service.id}`
      )
    ]);
    rows.push([Markup.button.callback("Назад", "back_main")]);

    await replyAndLog(
      ctx,
      mode === "booking" ? "Выберите услугу:" : "Наши услуги:",
      Markup.inlineKeyboard(rows)
    );
  };

  const showSlots = async (
    ctx: Context,
    serviceId: string,
    date: string,
    prefix: "slot" | "rsslot",
    specialistId?: string,
    periodText?: string,
    preloadedSlots?: SlotOption[]
  ) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      return;
    }

    const slots =
      preloadedSlots ??
      (await container.slotService.findSlots({
        serviceId,
        date,
        specialistId,
        periodText,
        limit: 4
      }));

    if (slots.length === 0) {
      await replyAndLog(
        ctx,
        "На это время свободных окон нет. Можно выбрать другой день или позвать администратора.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Выбрать другой день", prefix === "slot" ? "main_booking" : "my_appointments")],
          [Markup.button.callback("Позвать администратора", "admin_request")]
        ])
      );
      return;
    }

    const state = await container.conversationService.getState(telegramId);
    const oldData = container.conversationService.parseStateData<StateData>(state?.data, {});
    const data: StateData = {
      ...oldData,
      slots: slots.map((slot) => ({
        ...slot,
        startAt: slot.startAt.toISOString(),
        endAt: slot.endAt.toISOString()
      }))
    };

    await container.conversationService.saveState({
      telegramId,
      step: prefix === "slot" ? ConversationStep.ChoosingTime : ConversationStep.Rescheduling,
      selectedServiceId: serviceId,
      selectedDate: date,
      data
    });

    const rows = slots.map((slot, index) => [
      Markup.button.callback(
        `${toHumanTime(slot.startAt, container.config.timezone)} · ${slot.specialistName}`,
        `${prefix}:${index}`
      )
    ]);
    rows.push([Markup.button.callback("Назад", "back_main")]);

    await replyAndLog(ctx, "Есть такие свободные окна:", Markup.inlineKeyboard(rows));
  };

  const showAppointmentSummary = async (ctx: Context) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      return;
    }

    const state = await container.conversationService.getState(telegramId);
    if (!state?.selectedServiceId || !state.selectedSpecialistId || !state.selectedStartAt || !state.clientName) {
      await replyAndLog(ctx, "Не хватает данных для записи. Начните заново.", mainKeyboard());
      return;
    }

    const service = await container.serviceCatalog.getById(state.selectedServiceId);
    const specialist = await container.specialistService.getById(state.selectedSpecialistId);
    const address = await container.settingsService.get("studio_address");
    const landmark = await container.settingsService.get("studio_landmark");
    const rules = await container.settingsService.get("studio_visit_rules");

    await container.conversationService.saveState({
      telegramId,
      step: ConversationStep.ConfirmingBooking,
      selectedServiceId: state.selectedServiceId,
      selectedSpecialistId: state.selectedSpecialistId,
      selectedStartAt: state.selectedStartAt,
      clientName: state.clientName,
      clientPhone: state.clientPhone,
      data: state.data
    });

    await replyAndLog(
      ctx,
      `Проверьте запись:
${service.name}, ${service.durationMinutes} минут
Специалист: ${specialist.name}
Дата и время: ${toHumanDateTime(state.selectedStartAt, container.config.timezone)}
Цена: ${service.price} руб.
Имя: ${state.clientName}
Телефон: ${state.clientPhone ?? "не указан"}
Адрес: ${address}
${landmark}
${rules}

Подтвердить запись?`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Подтвердить", "confirm_booking")],
        [Markup.button.callback("Выбрать другое время", "main_booking")]
      ])
    );
  };

  const showMyAppointments = async (ctx: Context) => {
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      return;
    }

    const client = await container.clientService.findByTelegramId(telegramId);
    if (!client) {
      await replyAndLog(ctx, "Пока у вас нет записей.", mainKeyboard());
      return;
    }

    const appointments = await container.bookingService.activeByClient(client.id);
    if (appointments.length === 0) {
      await replyAndLog(ctx, "Активных записей нет.", mainKeyboard());
      return;
    }

    for (const appointment of appointments) {
      await replyAndLog(
        ctx,
        `${appointment.service.name}
Специалист: ${appointment.specialist.name}
Время: ${toHumanDateTime(appointment.startAt, container.config.timezone)}
Статус: ${appointment.status}`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback("Перенести", `reschedule:${appointment.id}`),
            Markup.button.callback("Отменить", `cancel:${appointment.id}`)
          ]
        ])
      );
    }
  };

  bot.start(async (ctx) => {
    const telegramId = getTelegramId(ctx);
    if (telegramId) {
      await container.conversationService.reset(telegramId);
      await container.conversationService.addClientMessage(telegramId, "/start", "start");
    }

    await replyAndLog(ctx, "Здравствуйте. Я AI-администратор студии. Чем помочь?", mainKeyboard());
  });

  bot.action("back_main", async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    if (telegramId) {
      await container.conversationService.reset(telegramId);
    }
    await replyAndLog(ctx, "Главное меню:", mainKeyboard());
  });

  bot.action("main_booking", async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    if (telegramId) {
      await container.conversationService.saveState({ telegramId, step: ConversationStep.ChoosingService });
    }
    await showServices(ctx, "booking");
  });

  bot.action("main_services", async (ctx) => {
    await ctx.answerCbQuery();
    await showServices(ctx, "view");
  });

  bot.action(/^service_info:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const id = getMatch(ctx);
    if (!id) {
      return;
    }
    const service = await container.serviceCatalog.getById(id);
    await replyAndLog(
      ctx,
      `${service.name}
Длительность: ${service.durationMinutes} минут
Цена: ${service.price} руб.
${service.description}`,
      mainKeyboard()
    );
  });

  bot.action(/^service:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const serviceId = getMatch(ctx);
    if (!telegramId || !serviceId) {
      return;
    }

    await container.conversationService.saveState({
      telegramId,
      step: ConversationStep.ChoosingDate,
      selectedServiceId: serviceId
    });

    await replyAndLog(ctx, "Выберите день:", dateKeyboard("date", container.config.timezone));
  });

  bot.action(/^date:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const date = getMatch(ctx);
    if (!telegramId || !date) {
      return;
    }

    const state = await container.conversationService.getState(telegramId);
    if (!state?.selectedServiceId) {
      await showServices(ctx, "booking");
      return;
    }

    await showSlots(ctx, state.selectedServiceId, date, "slot");
  });

  bot.action(/^slot:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const index = Number(getMatch(ctx));
    if (!telegramId || !Number.isFinite(index)) {
      return;
    }

    const state = await container.conversationService.getState(telegramId);
    const data = container.conversationService.parseStateData<StateData>(state?.data, {});
    const slot = data.slots?.[index];
    if (!slot) {
      await replyAndLog(ctx, "Это окно уже недоступно. Сейчас покажу другие варианты.", mainKeyboard());
      return;
    }

    await container.conversationService.saveState({
      telegramId,
      step: ConversationStep.EnteringName,
      selectedServiceId: slot.serviceId,
      selectedSpecialistId: slot.specialistId,
      selectedStartAt: new Date(slot.startAt),
      data
    });

    await replyAndLog(ctx, "Напишите, пожалуйста, имя и номер телефона одним сообщением.");
  });

  bot.action("confirm_booking", async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    if (!telegramId) {
      return;
    }

    const state = await container.conversationService.getState(telegramId);
    if (!state?.selectedServiceId || !state.selectedSpecialistId || !state.selectedStartAt || !state.clientName) {
      await replyAndLog(ctx, "Не хватает данных для записи. Начните заново.", mainKeyboard());
      return;
    }

    try {
      const created = await container.bookingService.createAppointment({
        clientName: state.clientName,
        clientPhone: state.clientPhone ?? undefined,
        telegramId,
        serviceId: state.selectedServiceId,
        specialistId: state.selectedSpecialistId,
        startAt: state.selectedStartAt,
        source: AppointmentSource.TelegramBot
      });

      const confirmation = await container.settingsService.get("confirmation_text");
      await container.conversationService.reset(telegramId);
      await replyAndLog(
        ctx,
        `${confirmation}

${created.service.name}
Специалист: ${created.specialist.name}
Время: ${toHumanDateTime(created.startAt, container.config.timezone)}`,
        mainKeyboard()
      );
    } catch (error) {
      await container.logService.error("telegram", "create_booking_failed", "Не удалось создать запись", {
        error: error instanceof Error ? error.message : String(error)
      });
      await replyAndLog(ctx, getUserMessage(error), mainKeyboard());
    }
  });

  bot.action("my_appointments", async (ctx) => {
    await ctx.answerCbQuery();
    await showMyAppointments(ctx);
  });

  bot.action(/^cancel:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const id = getMatch(ctx);
    if (!id) {
      return;
    }

    await replyAndLog(
      ctx,
      "Подтвердите отмену записи.",
      Markup.inlineKeyboard([
        [Markup.button.callback("Да, отменить", `confirm_cancel:${id}`)],
        [Markup.button.callback("Назад", "my_appointments")]
      ])
    );
  });

  bot.action(/^confirm_cancel:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const id = getMatch(ctx);
    if (!id) {
      return;
    }

    try {
      await container.bookingService.cancelAppointment(id, "client");
      await replyAndLog(ctx, "Запись отменена. Администратор получил уведомление.", mainKeyboard());
    } catch (error) {
      await replyAndLog(ctx, getUserMessage(error), mainKeyboard());
    }
  });

  bot.action(/^reschedule:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const appointmentId = getMatch(ctx);
    if (!telegramId || !appointmentId) {
      return;
    }

    await container.conversationService.saveState({
      telegramId,
      step: ConversationStep.Rescheduling,
      data: { appointmentId }
    });

    await replyAndLog(ctx, "На какой день перенести запись?", dateKeyboard("rsdate", container.config.timezone));
  });

  bot.action(/^rsdate:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const date = getMatch(ctx);
    if (!telegramId || !date) {
      return;
    }

    const state = await container.conversationService.getState(telegramId);
    const data = container.conversationService.parseStateData<StateData>(state?.data, {});
    if (!data.appointmentId) {
      await showMyAppointments(ctx);
      return;
    }

    const appointment = await container.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: { service: true, specialist: true }
    });

    if (!appointment) {
      await replyAndLog(ctx, "Не получилось найти запись.", mainKeyboard());
      return;
    }

    const sameSpecialistSlots = await container.slotService.findSlots({
      serviceId: appointment.serviceId,
      date,
      specialistId: appointment.specialistId,
      limit: 4
    });

    if (sameSpecialistSlots.length > 0) {
      await showSlots(ctx, appointment.serviceId, date, "rsslot", appointment.specialistId, undefined, sameSpecialistSlots);
      return;
    }

    const alternativeSlots = await container.slotService.findSlots({
      serviceId: appointment.serviceId,
      date,
      limit: 4
    });

    if (alternativeSlots.length > 0) {
      await replyAndLog(
        ctx,
        "У прежнего специалиста на этот день нет свободного окна. Показываю варианты у других специалистов."
      );
      await showSlots(ctx, appointment.serviceId, date, "rsslot", undefined, undefined, alternativeSlots);
      return;
    }

    await showSlots(ctx, appointment.serviceId, date, "rsslot", appointment.specialistId, undefined, []);
  });

  bot.action(/^rsslot:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    const index = Number(getMatch(ctx));
    if (!telegramId || !Number.isFinite(index)) {
      return;
    }

    const state = await container.conversationService.getState(telegramId);
    const data = container.conversationService.parseStateData<StateData>(state?.data, {});
    const slot = data.slots?.[index];
    if (!data.appointmentId || !slot) {
      await replyAndLog(ctx, "Это время уже недоступно. Попробуйте снова.", mainKeyboard());
      return;
    }

    try {
      const moved = await container.bookingService.rescheduleAppointment(
        data.appointmentId,
        slot.specialistId,
        new Date(slot.startAt),
        "client"
      );
      await container.conversationService.reset(telegramId);
      await replyAndLog(
        ctx,
        `Запись перенесена.
Новое время: ${toHumanDateTime(moved.startAt, container.config.timezone)}
Специалист: ${moved.specialist.name}`,
        mainKeyboard()
      );
    } catch (error) {
      await replyAndLog(ctx, getUserMessage(error), mainKeyboard());
    }
  });

  bot.action(/^visit_confirm:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const id = getMatch(ctx);
    if (!id) {
      return;
    }
    await container.bookingService.confirmVisit(id);
    await replyAndLog(ctx, "Спасибо, визит подтверждён.", mainKeyboard());
  });

  bot.action("admin_request", async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = getTelegramId(ctx);
    await container.adminNotificationService.attentionNeeded(
      "Клиент просит администратора",
      `Telegram ID: ${telegramId ?? "неизвестен"}`
    );
    await replyAndLog(ctx, "Я передал ваш вопрос администратору. Вам ответят в рабочее время.", mainKeyboard());
  });

  bot.on("text", async (ctx) => {
    const telegramId = getTelegramId(ctx);
    const text = getText(ctx);
    if (!telegramId || !text) {
      return;
    }

    await container.conversationService.addClientMessage(telegramId, text);

    const state = await container.conversationService.getState(telegramId);

    if (state?.step === ConversationStep.EnteringName) {
      const phone = parsePhone(text);
      const name = removePhone(text, phone);
      await container.conversationService.saveState({
        telegramId,
        step: phone ? ConversationStep.ConfirmingBooking : ConversationStep.EnteringPhone,
        selectedServiceId: state.selectedServiceId,
        selectedSpecialistId: state.selectedSpecialistId,
        selectedStartAt: state.selectedStartAt,
        clientName: name || text.trim(),
        clientPhone: phone,
        data: state.data
      });

      if (!phone) {
        await replyAndLog(ctx, "Спасибо. Теперь напишите номер телефона.");
        return;
      }

      await showAppointmentSummary(ctx);
      return;
    }

    if (state?.step === ConversationStep.EnteringPhone) {
      const phone = parsePhone(text);
      await container.conversationService.saveState({
        telegramId,
        step: ConversationStep.ConfirmingBooking,
        selectedServiceId: state.selectedServiceId,
        selectedSpecialistId: state.selectedSpecialistId,
        selectedStartAt: state.selectedStartAt,
        clientName: state.clientName,
        clientPhone: phone ?? text.trim(),
        data: state.data
      });
      await showAppointmentSummary(ctx);
      return;
    }

    const intent = await container.intentService.parse(text);

    if (intent.type === IntentType.PriceQuestion) {
      const service = await container.serviceCatalog.findByClientText(text);
      if (!service) {
        await replyAndLog(ctx, "По какой услуге подсказать цену?", mainKeyboard());
        return;
      }
      await replyAndLog(ctx, `${service.name}: ${service.price} руб., ${service.durationMinutes} минут.`, mainKeyboard());
      return;
    }

    if (intent.type === IntentType.MedicalQuestion) {
      await container.adminNotificationService.attentionNeeded(
        "Медицинский вопрос",
        `Клиент написал: ${text}
Telegram ID: ${telegramId}`
      );
      await replyAndLog(
        ctx,
        "По этому вопросу лучше проконсультироваться со специалистом. Я передам вопрос администратору.",
        mainKeyboard()
      );
      return;
    }

    if (intent.type === IntentType.Complaint || intent.type === IntentType.AdminRequest) {
      await container.adminNotificationService.attentionNeeded(
        "Клиенту нужен администратор",
        `Клиент написал: ${text}
Telegram ID: ${telegramId}`
      );
      await replyAndLog(ctx, "Я передал ваш вопрос администратору. Вам ответят в рабочее время.", mainKeyboard());
      return;
    }

    if (intent.type === IntentType.Cancel || intent.type === IntentType.Reschedule) {
      await showMyAppointments(ctx);
      return;
    }

    if (intent.type === IntentType.Booking) {
      const service = await container.serviceCatalog.findByClientText(text);
      if (!service) {
        await showServices(ctx, "booking");
        return;
      }

      const date = dateKeyFromText(text, container.config.timezone);
      if (!date) {
        await container.conversationService.saveState({
          telegramId,
          step: ConversationStep.ChoosingDate,
          selectedServiceId: service.id
        });
        await replyAndLog(ctx, "На какой день нужна запись?", dateKeyboard("date", container.config.timezone));
        return;
      }

      await showSlots(ctx, service.id, date, "slot", undefined, text);
      return;
    }

    await replyAndLog(
      ctx,
      "Я не совсем понял сообщение. Вы хотите записаться или позвать администратора?",
      Markup.inlineKeyboard([
        [Markup.button.callback("Записаться", "main_booking")],
        [Markup.button.callback("Позвать администратора", "admin_request")]
      ])
    );
  });

  bot.catch(async (error) => {
    await container.logService.error("telegram", "bot_error", "Ошибка Telegram-бота", {
      error: error instanceof Error ? error.message : String(error)
    });
  });

  return bot;
};
