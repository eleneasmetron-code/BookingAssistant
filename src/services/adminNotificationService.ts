import { Telegram } from "telegraf";
import { ConfigService } from "../config/configService.js";
import { toHumanDateTime } from "../utils/dateTime.js";
import { LogService } from "./logService.js";

interface AppointmentNotification {
  clientName: string;
  clientPhone?: string | null;
  serviceName: string;
  specialistName: string;
  startAt: Date;
  source: string;
}

export class AdminNotificationService {
  private readonly telegram?: Telegram;

  constructor(
    private readonly config: ConfigService,
    private readonly logs: LogService
  ) {
    this.telegram = config.hasTelegramToken() ? new Telegram(config.telegramBotToken) : undefined;
  }

  async appointmentCreated(data: AppointmentNotification) {
    await this.send(`Новая запись
${data.clientName}${data.clientPhone ? `, ${data.clientPhone}` : ""}
Услуга: ${data.serviceName}
Специалист: ${data.specialistName}
Дата: ${toHumanDateTime(data.startAt, this.config.timezone)}
Источник: ${data.source}`);
  }

  async appointmentCanceled(data: AppointmentNotification) {
    await this.send(`Отмена записи
${data.clientName}${data.clientPhone ? `, ${data.clientPhone}` : ""}
Услуга: ${data.serviceName}
Специалист: ${data.specialistName}
Дата: ${toHumanDateTime(data.startAt, this.config.timezone)}
Источник: ${data.source}`);
  }

  async appointmentRescheduled(data: AppointmentNotification & { oldStartAt: Date }) {
    await this.send(`Перенос записи
${data.clientName}${data.clientPhone ? `, ${data.clientPhone}` : ""}
Услуга: ${data.serviceName}
Специалист: ${data.specialistName}
Было: ${toHumanDateTime(data.oldStartAt, this.config.timezone)}
Стало: ${toHumanDateTime(data.startAt, this.config.timezone)}
Источник: ${data.source}`);
  }

  async attentionNeeded(title: string, text: string) {
    await this.send(`${title}

${text}`);
  }

  private async send(text: string) {
    if (!this.config.hasAdminChat() || !this.telegram) {
      await this.logs.warning(
        "admin-notification",
        "skip",
        "Не настроен токен Telegram или ID чата администратора",
        { text }
      );
      return;
    }

    try {
      await this.telegram.sendMessage(this.config.adminTelegramChatId, text);
    } catch (error) {
      await this.logs.error("admin-notification", "send_failed", "Не удалось отправить сообщение", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
