import type { Prisma, PrismaClient } from "@prisma/client";
import { ReminderStatus } from "../domain/statuses.js";

export class ReminderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  createMany(data: Prisma.ReminderCreateManyInput[]) {
    return this.prisma.reminder.createMany({ data });
  }

  cancelForAppointment(appointmentId: string) {
    return this.prisma.reminder.updateMany({
      where: { appointmentId, status: ReminderStatus.Planned },
      data: { status: ReminderStatus.Canceled }
    });
  }

  findDue(now = new Date()) {
    return this.prisma.reminder.findMany({
      where: {
        status: ReminderStatus.Planned,
        sendAt: { lte: now }
      },
      include: {
        appointment: {
          include: { client: true, service: true, specialist: true }
        }
      },
      orderBy: { sendAt: "asc" },
      take: 50
    });
  }

  findNextPlanned() {
    return this.prisma.reminder.findFirst({
      where: { status: ReminderStatus.Planned },
      include: {
        appointment: {
          include: { client: true, service: true, specialist: true }
        }
      },
      orderBy: { sendAt: "asc" }
    });
  }

  findByIdWithAppointment(id: string) {
    return this.prisma.reminder.findUnique({
      where: { id },
      include: {
        appointment: {
          include: { client: true, service: true, specialist: true }
        }
      }
    });
  }

  markSent(id: string) {
    return this.prisma.reminder.update({
      where: { id },
      data: { status: ReminderStatus.Sent, sentAt: new Date(), error: null }
    });
  }

  markFailed(id: string, error: string) {
    return this.prisma.reminder.update({
      where: { id },
      data: { status: ReminderStatus.Failed, error }
    });
  }
}
