import type { Prisma, PrismaClient } from "@prisma/client";
import { activeAppointmentStatuses } from "../domain/statuses.js";
import type { AppointmentFilters } from "../domain/types.js";

export class AppointmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: { client: true, service: true, specialist: true, reminders: true }
    });
  }

  findMany(filters: AppointmentFilters = {}) {
    const where: Prisma.AppointmentWhereInput = {
      ...(filters.specialistId ? { specialistId: filters.specialistId } : {}),
      ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
      ...(filters.status ? { status: filters.status } : {})
    };

    if (filters.dateFrom && filters.dateTo) {
      where.startAt = { gte: filters.dateFrom, lte: filters.dateTo };
    } else if (filters.date) {
      where.startAt = {
        gte: new Date(`${filters.date}T00:00:00.000Z`),
        lte: new Date(`${filters.date}T23:59:59.999Z`)
      };
    }

    if (filters.search) {
      where.OR = [
        { clientNameSnapshot: { contains: filters.search } },
        { clientPhoneSnapshot: { contains: filters.search } },
        { client: { telegramId: { contains: filters.search } } }
      ];
    }

    return this.prisma.appointment.findMany({
      where,
      include: { client: true, service: true, specialist: true },
      orderBy: { startAt: "asc" }
    });
  }

  findActiveByClient(clientId: string) {
    return this.prisma.appointment.findMany({
      where: { clientId, status: { in: activeAppointmentStatuses } },
      include: { service: true, specialist: true },
      orderBy: { startAt: "asc" }
    });
  }

  findOverlapping(specialistId: string, startAt: Date, endAt: Date, excludeAppointmentId?: string) {
    return this.prisma.appointment.findFirst({
      where: {
        specialistId,
        status: { in: activeAppointmentStatuses },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        startAt: { lt: endAt },
        endAt: { gt: startAt }
      }
    });
  }

  create(data: Prisma.AppointmentUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.appointment.create({ data });
  }

  updateStatus(id: string, status: string, extra: Prisma.AppointmentUpdateInput = {}) {
    return this.prisma.appointment.update({
      where: { id },
      data: { status, ...extra },
      include: { client: true, service: true, specialist: true }
    });
  }

  createTransfer(data: Prisma.AppointmentTransferUncheckedCreateInput) {
    return this.prisma.appointmentTransfer.create({ data });
  }
}
