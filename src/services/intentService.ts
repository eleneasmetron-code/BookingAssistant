import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConfigService } from "../config/configService.js";
import { IntentType } from "../domain/statuses.js";
import type { ParsedIntent } from "../domain/types.js";
import { dateKeyFromText, periodToStartMinute } from "../utils/dateTime.js";
import { LogService } from "./logService.js";
import { ServiceCatalog } from "./serviceCatalog.js";

export class IntentService {
  private readonly genAi?: GoogleGenerativeAI;

  constructor(
    private readonly config: ConfigService,
    private readonly serviceCatalog: ServiceCatalog,
    private readonly logs: LogService
  ) {
    this.genAi = config.hasGeminiKey() ? new GoogleGenerativeAI(config.geminiApiKey) : undefined;
  }

  async parse(text: string): Promise<ParsedIntent> {
    const normalized = text.trim().toLowerCase();
    const service = await this.serviceCatalog.findByClientText(normalized);
    const dateText = dateKeyFromText(normalized, this.config.timezone);
    const hasPeriod = periodToStartMinute(normalized) !== undefined;

    const simple = this.parseByRules(normalized, service?.name, dateText, hasPeriod ? normalized : undefined);
    if (simple.type !== IntentType.Unknown || !this.genAi) {
      return { ...simple, rawText: text };
    }

    return this.parseByGemini(text, service?.name, dateText);
  }

  private parseByRules(
    text: string,
    serviceName?: string,
    dateText?: string,
    periodText?: string
  ): ParsedIntent {
    const hasAny = (words: string[]) => words.some((word) => text.includes(word));

    if (hasAny(["плохо", "жалоб", "недовол", "не ответили", "проблем"])) {
      return { type: IntentType.Complaint, serviceName, dateText, periodText, confidence: 0.9, rawText: text };
    }

    if (hasAny(["противопоказ", "беремен", "диагноз", "остр", "болит", "лечен", "стало плохо"])) {
      return {
        type: IntentType.MedicalQuestion,
        serviceName,
        dateText,
        periodText,
        confidence: 0.9,
        rawText: text
      };
    }

    if (hasAny(["администратор", "оператор", "человек", "позовите", "позвать"])) {
      return {
        type: IntentType.AdminRequest,
        serviceName,
        dateText,
        periodText,
        confidence: 0.9,
        rawText: text
      };
    }

    if (hasAny(["отмен", "не приду"])) {
      return { type: IntentType.Cancel, serviceName, dateText, periodText, confidence: 0.9, rawText: text };
    }

    if (hasAny(["перенес", "перезапис", "другое время"])) {
      return {
        type: IntentType.Reschedule,
        serviceName,
        dateText,
        periodText,
        confidence: 0.9,
        rawText: text
      };
    }

    if (hasAny(["сколько", "цена", "стоит", "стоимость"])) {
      return {
        type: IntentType.PriceQuestion,
        serviceName,
        dateText,
        periodText,
        confidence: 0.85,
        rawText: text
      };
    }

    if (hasAny(["запис", "хочу", "можно", "есть свобод", "ближайш", "окно"]) || serviceName) {
      return { type: IntentType.Booking, serviceName, dateText, periodText, confidence: 0.8, rawText: text };
    }

    return { type: IntentType.Unknown, serviceName, dateText, periodText, confidence: 0.2, rawText: text };
  }

  private async parseByGemini(text: string, serviceName?: string, dateText?: string): Promise<ParsedIntent> {
    try {
      const model = this.genAi?.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model?.generateContent(
        `Определи намерение клиента для записи в студию. Верни только JSON с полями type и confidence.
Доступные type: booking, price_question, service_question, cancel, reschedule, complaint, admin_request, medical_question, unknown.
Текст клиента: ${text}`
      );
      const raw = result?.response.text() ?? "{}";
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = match ? (JSON.parse(match[0]) as { type?: string; confidence?: number }) : {};

      return {
        type: parsed.type ?? IntentType.Unknown,
        serviceName,
        dateText,
        confidence: parsed.confidence ?? 0.5,
        rawText: text
      };
    } catch (error) {
      await this.logs.warning("intent", "gemini_failed", "Gemini не смог разобрать сообщение", {
        error: error instanceof Error ? error.message : String(error)
      });
      return { type: IntentType.Unknown, serviceName, dateText, confidence: 0.2, rawText: text };
    }
  }
}
