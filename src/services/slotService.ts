import { ConfigService } from "../config/configService.js";
import { SlotUnavailableError } from "../domain/errors.js";
import type { SlotOption } from "../domain/types.js";
import { AppointmentRepository } from "../repositories/appointmentRepository.js";
import {
  addMinutesToDate,
  getLocalDayOfWeek,
  localDateTimeToUtc,
  minutesFromTime,
  periodToStartMinute,
  toLocalDateKey,
  timeFromMinutes
} from "../utils/dateTime.js";
import { ServiceCatalog } from "./serviceCatalog.js";
import { SpecialistService } from "./specialistService.js";

interface FindSlotsInput {
  serviceId: string;
  date: string;
  specialistId?: string;
  periodText?: string;
  limit?: number;
}

export class SlotService {
  constructor(
    private readonly config: ConfigService,
    private readonly serviceCatalog: ServiceCatalog,
    private readonly specialistService: SpecialistService,
    private readonly appointments: AppointmentRepository
  ) {}

  async findSlots(input: FindSlotsInput): Promise<SlotOption[]> {
    const service = await this.serviceCatalog.getById(input.serviceId);
    if (!service.isActive) {
      return [];
    }

    const specialists = input.specialistId
      ? [await this.specialistService.getById(input.specialistId)]
      : await this.specialistService.findByService(input.serviceId);

    const dayOfWeek = getLocalDayOfWeek(input.date, this.config.timezone);
    const periodStart = periodToStartMinute(input.periodText);
    const limit = input.limit ?? 4;
    const slots: SlotOption[] = [];

    for (const specialist of specialists) {
      if (!specialist.isActive) {
        continue;
      }

      const workingHours = specialist.workingHours.filter((item) => item.dayOfWeek === dayOfWeek);
      const breaks = specialist.breaks.filter((item) => item.dayOfWeek === dayOfWeek);
      const blocks = specialist.timeBlocks.filter((item) => item.date === input.date);

      for (const work of workingHours) {
        const workStart = minutesFromTime(work.startTime);
        const workEnd = minutesFromTime(work.endTime);
        const firstMinute = Math.max(workStart, periodStart ?? workStart);
        const serviceTotal = service.bufferBefore + service.durationMinutes + service.bufferAfter;

        for (let minute = firstMinute; minute + serviceTotal <= workEnd; minute += 10) {
          const actualStartMinute = minute + service.bufferBefore;
          const startAt = localDateTimeToUtc(input.date, timeFromMinutes(actualStartMinute), this.config.timezone);
          const endAt = addMinutesToDate(startAt, service.durationMinutes);
          const bufferedStart = localDateTimeToUtc(input.date, timeFromMinutes(minute), this.config.timezone);
          const bufferedEnd = addMinutesToDate(bufferedStart, serviceTotal);

          if (startAt <= new Date()) {
            continue;
          }

          const overlapsBreak = breaks.some((item) =>
            this.overlaps(
              minute,
              minute + serviceTotal,
              minutesFromTime(item.startTime),
              minutesFromTime(item.endTime)
            )
          );

          const overlapsBlock = blocks.some((item) =>
            this.overlaps(
              minute,
              minute + serviceTotal,
              minutesFromTime(item.startTime),
              minutesFromTime(item.endTime)
            )
          );

          if (overlapsBreak || overlapsBlock) {
            continue;
          }

          const busy = await this.appointments.findOverlapping(specialist.id, bufferedStart, bufferedEnd);
          if (busy) {
            continue;
          }

          slots.push({
            key: String(slots.length),
            serviceId: service.id,
            specialistId: specialist.id,
            specialistName: specialist.name,
            serviceName: service.name,
            startAt,
            endAt,
            price: service.price,
            durationMinutes: service.durationMinutes
          });

          if (slots.length >= limit) {
            return slots;
          }
        }
      }
    }

    return slots;
  }

  async assertSlotFree(serviceId: string, specialistId: string, startAt: Date): Promise<void> {
    const service = await this.serviceCatalog.getById(serviceId);
    const bufferedStart = addMinutesToDate(startAt, -service.bufferBefore);
    const bufferedEnd = addMinutesToDate(startAt, service.durationMinutes + service.bufferAfter);
    const busy = await this.appointments.findOverlapping(specialistId, bufferedStart, bufferedEnd);

    if (busy) {
      throw new SlotUnavailableError({ serviceId, specialistId, startAt });
    }
  }

  async assertSlotBookable(serviceId: string, specialistId: string, startAt: Date): Promise<void> {
    const date = toLocalDateKey(startAt, this.config.timezone);
    const slots = await this.findSlots({
      serviceId,
      specialistId,
      date,
      limit: 200
    });

    const exists = slots.some((slot) => slot.startAt.getTime() === startAt.getTime());
    if (!exists) {
      throw new SlotUnavailableError({ serviceId, specialistId, startAt, reason: "not_bookable" });
    }
  }

  private overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
    return startA < endB && endA > startB;
  }
}
