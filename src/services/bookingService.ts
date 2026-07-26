import type { PrismaClient } from "@prisma/client";
import { ConfigService } from "../config/configService.js";
import {
  LateCancelNeedsAdminError,
  NotFoundError,
  SlotUnavailableError
} from "../domain/errors.js";
import { AppointmentSource, AppointmentStatus, activeAppointmentStatuses } from "../domain/statuses.js";
import type { AppointmentFilters, CreateAppointmentInput } from "../domain/types.js";
import { AppointmentRepository } from "../repositories/appointmentRepository.js";
import { ClientService } from "./clientService.js";
import { LogService } from "./logService.js";
import { ReminderService } from "./reminderService.js";
import { ServiceCatalog } from "./serviceCatalog.js";
import { AdminNotificationService } from "./adminNotificationService.js";
import { addMinutesToDate, localDateRangeToUtc } from "../utils/dateTime.js";
import { SlotService } from "./slotService.js";

export class BookingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: ConfigService,
    private readonly appointments: AppointmentRepository,
    private readonly clients: ClientService,
    private readonly serviceCatalog: ServiceCatalog,
    private readonly slotService: SlotService,
    private readonly reminders: ReminderService,
    private readonly adminNotifications: AdminNotificationService,
    private readonly logs: LogService
  ) {}

  async createAppointment(input: CreateAppointmentInput) {
    const service = await this.serviceCatalog.getById(input.serviceId);
    if (!service.isActive) {
      throw new NotFoundError("Активная услуга");
    }

    await this.slotService.assertSlotBookable(input.serviceId, input.specialistId, input.startAt);

    const endAt = addMinutesToDate(input.startAt, service.durationMinutes);
    const bufferedStart = addMinutesToDate(input.startAt, -service.bufferBefore);
    const bufferedEnd = addMinutesToDate(input.startAt, service.durationMinutes + service.bufferAfter);

    const created = await this.prisma.$transaction(async (tx) => {
      const overlapping = await tx.appointment.findFirst({
        where: {
          specialistId: input.specialistId,
          status: { in: activeAppointmentStatuses },
          startAt: { lt: bufferedEnd },
          endAt: { gt: bufferedStart }
        }
      });

      if (overlapping) {
        throw new SlotUnavailableError({ existingAppointmentId: overlapping.id });
      }

      const identityFilters = [
        ...(input.telegramId ? [{ telegramId: input.telegramId }] : []),
        ...(input.clientPhone ? [{ phone: input.clientPhone }] : [])
      ];
      const existingClient =
        identityFilters.length > 0
          ? await tx.client.findFirst({
              where: { OR: identityFilters }
            })
          : null;

      const client = existingClient
        ? await tx.client.update({
            where: { id: existingClient.id },
            data: {
              name: input.clientName,
              phone: input.clientPhone ?? existingClient.phone,
              telegramId: input.telegramId ?? existingClient.telegramId,
              lastVisitAt: input.startAt,
              appointmentCount: { increment: 1 }
            }
          })
        : await tx.client.create({
            data: {
          name: input.clientName,
          phone: input.clientPhone,
          telegramId: input.telegramId,
          firstVisitAt: input.startAt,
          lastVisitAt: input.startAt,
          appointmentCount: 1
            }
          });

      return tx.appointment.create({
        data: {
          clientId: client.id,
          serviceId: input.serviceId,
          specialistId: input.specialistId,
          startAt: input.startAt,
          endAt,
          status: AppointmentStatus.Confirmed,
          source: input.source,
          clientNameSnapshot: input.clientName,
          clientPhoneSnapshot: input.clientPhone,
          comment: input.comment
        },
        include: { client: true, service: true, specialist: true }
      });
    });

    await this.reminders.createForAppointment(created.id, created.startAt);
    await this.logs.info("booking", "created", "Создана запись", { appointmentId: created.id });
    await this.adminNotifications.appointmentCreated({
      clientName: created.clientNameSnapshot,
      clientPhone: created.clientPhoneSnapshot,
      serviceName: created.service.name,
      specialistName: created.specialist.name,
      startAt: created.startAt,
      source: created.source
    });

    return created;
  }

  async cancelAppointment(id: string, movedBy = "client", force = false) {
    const appointment = await this.appointments.findById(id);
    if (!appointment) {
      throw new NotFoundError("Запись");
    }

    const hoursBefore = (appointment.startAt.getTime() - Date.now()) / 1000 / 60 / 60;
    if (!force && movedBy === "client" && hoursBefore < this.config.lateCancelHours) {
      await this.adminNotifications.attentionNeeded(
        "Поздняя отмена",
        `${appointment.clientNameSnapshot} хочет отменить запись меньше чем за ${this.config.lateCancelHours} часа до визита.`
      );
      await this.logs.warning("booking", "late_cancel", "Поздняя отмена передана администратору", {
        appointmentId: id
      });
      throw new LateCancelNeedsAdminError();
    }

    const canceled = await this.appointments.updateStatus(id, AppointmentStatus.Canceled);
    await this.reminders.cancelForAppointment(id);
    await this.logs.info("booking", "canceled", "Запись отменена", { appointmentId: id, movedBy });
    await this.adminNotifications.appointmentCanceled({
      clientName: canceled.clientNameSnapshot,
      clientPhone: canceled.clientPhoneSnapshot,
      serviceName: canceled.service.name,
      specialistName: canceled.specialist.name,
      startAt: canceled.startAt,
      source: canceled.source
    });

    return canceled;
  }

  async rescheduleAppointment(id: string, newSpecialistId: string, newStartAt: Date, movedBy = "client") {
    const oldAppointment = await this.appointments.findById(id);
    if (!oldAppointment) {
      throw new NotFoundError("Запись");
    }

    const newAppointment = await this.createAppointment({
      clientName: oldAppointment.clientNameSnapshot,
      clientPhone: oldAppointment.clientPhoneSnapshot ?? undefined,
      telegramId: oldAppointment.client.telegramId ?? undefined,
      serviceId: oldAppointment.serviceId,
      specialistId: newSpecialistId,
      startAt: newStartAt,
      source: oldAppointment.source === AppointmentSource.Manual ? AppointmentSource.Manual : AppointmentSource.TelegramBot,
      comment: oldAppointment.comment ?? undefined
    });

    await this.appointments.updateStatus(id, AppointmentStatus.Rescheduled);
    await this.reminders.cancelForAppointment(id);
    await this.appointments.createTransfer({
      oldAppointmentId: id,
      newAppointmentId: newAppointment.id,
      oldStartAt: oldAppointment.startAt,
      newStartAt: newAppointment.startAt,
      movedBy
    });
    await this.logs.info("booking", "rescheduled", "Запись перенесена", {
      oldAppointmentId: id,
      newAppointmentId: newAppointment.id
    });
    await this.adminNotifications.appointmentRescheduled({
      clientName: newAppointment.clientNameSnapshot,
      clientPhone: newAppointment.clientPhoneSnapshot,
      serviceName: newAppointment.service.name,
      specialistName: newAppointment.specialist.name,
      oldStartAt: oldAppointment.startAt,
      startAt: newAppointment.startAt,
      source: newAppointment.source
    });

    return newAppointment;
  }

  updateAppointmentStatus(id: string, status: string) {
    return this.appointments.updateStatus(id, status);
  }

  async confirmVisit(id: string) {
    return this.appointments.updateStatus(id, AppointmentStatus.Confirmed, {
      confirmedByClientAt: new Date()
    });
  }

  list(filters: AppointmentFilters = {}) {
    if (filters.date) {
      const range = localDateRangeToUtc(filters.date, this.config.timezone);
      return this.appointments.findMany({
        ...filters,
        dateFrom: range.from,
        dateTo: range.to
      });
    }

    return this.appointments.findMany(filters);
  }

  activeByClient(clientId: string) {
    return this.appointments.findActiveByClient(clientId);
  }
}
