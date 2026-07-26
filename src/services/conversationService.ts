import { ConversationStep } from "../domain/statuses.js";
import { ConversationRepository } from "../repositories/conversationRepository.js";
import { parseJsonSafe, stringifySafe } from "../utils/json.js";

export class ConversationService {
  constructor(private readonly conversations: ConversationRepository) {}

  getState(telegramId: string) {
    return this.conversations.getState(telegramId);
  }

  saveState(input: {
    telegramId: string;
    clientId?: string | null;
    step: string;
    selectedServiceId?: string | null;
    selectedSpecialistId?: string | null;
    selectedDate?: string | null;
    selectedStartAt?: Date | null;
    clientName?: string | null;
    clientPhone?: string | null;
    data?: unknown;
    expiresAt?: Date | null;
  }) {
    return this.conversations.saveState({
      ...input,
      data: input.data === undefined ? undefined : stringifySafe(input.data)
    });
  }

  reset(telegramId: string) {
    return this.conversations.resetState(telegramId);
  }

  addClientMessage(telegramId: string, text: string, actionType?: string, clientId?: string | null) {
    return this.conversations.addMessage({
      telegramId,
      clientId,
      direction: "client",
      text,
      actionType
    });
  }

  addBotMessage(telegramId: string, text: string, actionType?: string, clientId?: string | null) {
    return this.conversations.addMessage({
      telegramId,
      clientId,
      direction: "bot",
      text,
      actionType
    });
  }

  parseStateData<T>(data: string | null | undefined, fallback: T): T {
    return parseJsonSafe(data, fallback);
  }

  idle(telegramId: string) {
    return this.saveState({ telegramId, step: ConversationStep.Idle, data: null });
  }
}
