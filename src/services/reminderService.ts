import { Telegram } from "telegraf";
import { ConfigService } from "../config/configService.js";
import { ReminderStatus, ReminderType } from "../domain/statuses.js";
import { ReminderRepository } from "../repositories/reminderRepository.js";
import { addMinutesToDate, toHumanDateTime } from "../utils/dateTime.js";
import { LogService } from "./logService.js";
import { SettingsService } from "./settingsService.js";

export class ReminderService {
  private readonly telegram?: Telegram;

  constructor(
    private readonly config: ConfigService,
    private readonly reminders: ReminderRepository,
    private readonly settings: SettingsService,
    private readonly logs: LogService
  ) {
    this.telegram = config.hasTelegramToken() ? new Telegram(config.telegramBotToken) : undefined;
  }

  async createForAppointment(appointmentId: string, startAt: Date) {
    const now = new Date();
    const data = [];

    if (this.config.reminder24hEnabled) {
      const sendAt = addMinutesToDate(startAt, -24 * 60);
      if (sendAt > now) {
        data.push({
          appointmentId,
          type: ReminderType.DayBefore,
          sendAt,
          status: ReminderStatus.Planned
        });
      }
    }

    if (this.config.reminder2hEnabled) {
      const sendAt = addMinutesToDate(startAt, -2 * 60);
      if (sendAt > now) {
        data.push({
          appointmentId,
          type: ReminderType.TwoHoursBefore,
          sendAt,
          status: ReminderStatus.Planned
        });
      }
    }

    if (data.length > 0) {
      await this.reminders.createMany(data);
    }
  }

  cancelForAppointment(appointmentId: string) {
    return this.reminders.cancelForAppointment(appointmentId);
  }

  async processDue() {
    const due = await this.reminders.findDue();
    for (const reminder of due) {
      await this.sendReminder(reminder.id);
    }
  }

  async sendNextPlannedForTest() {
    const next = await this.reminders.findNextPlanned();
    if (!next) {
      return { sent: false, message: "Нет запланированных напоминаний" };
    }

    await this.sendReminder(next.id);
    return { sent: true, message: "Тестовое напоминание отправлено" };
  }

  private async sendReminder(reminderId: string) {
    const reminder = await this.reminders.findByIdWithAppointment(reminderId);
    if (!reminder) {
      return;
    }

    const appointment = reminder.appointment;
    const clientTelegramId = appointment.client.telegramId;

    if (!clientTelegramId || !this.telegram) {
      if (this.config.demoMode) {
        await this.reminders.markSent(reminder.id);
        await this.logs.info("reminder", "demo_sent", "Напоминание отмечено отправленным в демо-режиме", {
          reminderId: reminder.id
        });
        return;
      }

      await this.reminders.markFailed(reminder.id, "Нет Telegram ID клиента или токена бота");
      await this.logs.warning("reminder", "send_skipped", "Напоминание не отправлено", {
        reminderId: reminder.id
      });
      return;
    }

    const settingsKey =
      reminder.type === ReminderType.DayBefore ? "reminder_24h_text" : "reminder_2h_text";
    const template = await this.settings.get(settingsKey);
    const text = `${template}

${appointment.service.name}
Специалист: ${appointment.specialist.name}
Время: ${toHumanDateTime(appointment.startAt, this.config.timezone)}
Адрес: ${await this.settings.get("studio_address")}`;

    try {
      await this.telegram.sendMessage(clientTelegramId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Подтвердить визит", callback_data: `visit_confirm:${appointment.id}` }],
            [
              { text: "Перенести", callback_data: `reschedule:${appointment.id}` },
              { text: "Отменить", callback_data: `cancel:${appointment.id}` }
            ],
            [{ text: "Написать администратору", callback_data: "admin_request" }]
          ]
        }
      });
      await this.reminders.markSent(reminder.id);
      await this.logs.info("reminder", "sent", "Напоминание отправлено", { reminderId: reminder.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.reminders.markFailed(reminder.id, message);
      await this.logs.error("reminder", "send_failed", "Не удалось отправить напоминание", {
        reminderId: reminder.id,
        error: message
      });
    }
  }
}
