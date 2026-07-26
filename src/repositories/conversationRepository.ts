import type { PrismaClient } from "@prisma/client";

export class ConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getState(telegramId: string) {
    return this.prisma.conversationState.findUnique({ where: { telegramId } });
  }

  saveState(data: {
    telegramId: string;
    clientId?: string | null;
    step: string;
    selectedServiceId?: string | null;
    selectedSpecialistId?: string | null;
    selectedDate?: string | null;
    selectedStartAt?: Date | null;
    clientName?: string | null;
    clientPhone?: string | null;
    data?: string | null;
    expiresAt?: Date | null;
  }) {
    return this.prisma.conversationState.upsert({
      where: { telegramId: data.telegramId },
      create: data,
      update: data
    });
  }

  resetState(telegramId: string) {
    return this.prisma.conversationState.upsert({
      where: { telegramId },
      create: { telegramId, step: "idle" },
      update: {
        step: "idle",
        selectedServiceId: null,
        selectedSpecialistId: null,
        selectedDate: null,
        selectedStartAt: null,
        clientName: null,
        clientPhone: null,
        data: null,
        expiresAt: null
      }
    });
  }

  addMessage(data: {
    clientId?: string | null;
    telegramId?: string | null;
    direction: string;
    text: string;
    selectedServiceId?: string | null;
    selectedStartAt?: Date | null;
    actionType?: string | null;
  }) {
    return this.prisma.conversationMessage.create({ data });
  }
}
