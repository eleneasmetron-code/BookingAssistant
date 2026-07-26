import type { PrismaClient } from "@prisma/client";

export class ClientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByTelegramId(telegramId: string) {
    return this.prisma.client.findUnique({ where: { telegramId } });
  }

  findByPhone(phone: string) {
    return this.prisma.client.findFirst({ where: { phone } });
  }

  findMany(search?: string) {
    return this.prisma.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { telegramId: { contains: search } }
            ]
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        appointments: {
          include: { service: true, specialist: true },
          orderBy: { startAt: "desc" },
          take: 10
        }
      }
    });
  }

  upsertClient(input: { name: string; phone?: string; telegramId?: string }) {
    if (input.telegramId) {
      return this.prisma.client.upsert({
        where: { telegramId: input.telegramId },
        create: {
          name: input.name,
          phone: input.phone,
          telegramId: input.telegramId,
          firstVisitAt: new Date()
        },
        update: {
          name: input.name,
          phone: input.phone ?? undefined
        }
      });
    }

    return this.prisma.client.create({
      data: {
        name: input.name,
        phone: input.phone,
        firstVisitAt: new Date()
      }
    });
  }

  incrementAppointmentStats(clientId: string, startAt: Date) {
    return this.prisma.client.update({
      where: { id: clientId },
      data: {
        appointmentCount: { increment: 1 },
        lastVisitAt: startAt
      }
    });
  }
}
