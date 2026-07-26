import { ConfigService } from "../config/configService.js";
import { SettingsRepository } from "../repositories/settingsRepository.js";

const defaultDescriptions: Record<string, string> = {
  studio_address: "Адрес студии",
  studio_landmark: "Ориентир",
  studio_visit_rules: "Правила визита",
  timezone: "Часовой пояс",
  admin_working_hours: "Рабочее время администратора",
  confirmation_text: "Текст подтверждения записи",
  reminder_24h_text: "Текст напоминания за сутки",
  reminder_2h_text: "Текст напоминания за 2 часа",
  late_cancel_hours: "За сколько часов отмена считается поздней"
};

export class SettingsService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly config: ConfigService
  ) {}

  defaults() {
    return {
      studio_address: this.config.studioAddress,
      studio_landmark: this.config.studioLandmark,
      studio_visit_rules: this.config.studioVisitRules,
      timezone: this.config.timezone,
      admin_working_hours: "09:00-20:00",
      confirmation_text:
        "Готово, вы записаны. За день и за 2 часа я напомню о визите.",
      reminder_24h_text:
        "Напоминаем: завтра у вас запись. Если не сможете прийти, пожалуйста, отмените или перенесите запись заранее.",
      reminder_2h_text:
        "Ждём вас сегодня. Если задерживаетесь, напишите администратору.",
      late_cancel_hours: String(this.config.lateCancelHours)
    };
  }

  async ensureDefaults() {
    const defaults = this.defaults();
    await Promise.all(
      Object.entries(defaults).map(([key, value]) =>
        this.settings.upsert(key, value, defaultDescriptions[key])
      )
    );
  }

  async get(key: string) {
    const existing = await this.settings.findByKey(key);
    if (existing) {
      return existing.value;
    }

    return this.defaults()[key as keyof ReturnType<SettingsService["defaults"]>] ?? "";
  }

  list() {
    return this.settings.findAll();
  }

  update(key: string, value: string) {
    return this.settings.upsert(key, value, defaultDescriptions[key]);
  }
}
