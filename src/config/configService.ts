import "dotenv/config";

const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const readNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export class ConfigService {
  readonly telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
  readonly adminTelegramChatId = process.env.ADMIN_TELEGRAM_CHAT_ID ?? "";
  readonly geminiApiKey = process.env.GEMINI_API_KEY ?? "";
  readonly databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  readonly adminSecret = process.env.ADMIN_SECRET ?? "demo-admin-secret";
  readonly timezone = process.env.APP_TIMEZONE ?? "UTC";
  readonly studioAddress = process.env.STUDIO_ADDRESS ?? "г. Лунарск, демо-студия, ул. Рассветная 10";
  readonly studioLandmark = process.env.STUDIO_LANDMARK ?? "Ориентир: стеклянная арка у входа";
  readonly studioVisitRules =
    process.env.STUDIO_VISIT_RULES ?? "Пожалуйста, приходите за 10 минут до начала";
  readonly demoMode = readBoolean(process.env.DEMO_MODE, true);
  readonly lateCancelHours = readNumber(process.env.LATE_CANCEL_HOURS, 3);
  readonly reminder24hEnabled = readBoolean(process.env.REMINDER_24H_ENABLED, true);
  readonly reminder2hEnabled = readBoolean(process.env.REMINDER_2H_ENABLED, true);
  readonly port = readNumber(process.env.PORT, 3000);

  hasTelegramToken(): boolean {
    return this.telegramBotToken.trim().length > 0;
  }

  hasAdminChat(): boolean {
    return this.adminTelegramChatId.trim().length > 0;
  }

  hasGeminiKey(): boolean {
    return this.geminiApiKey.trim().length > 0;
  }
}

export const configService = new ConfigService();

