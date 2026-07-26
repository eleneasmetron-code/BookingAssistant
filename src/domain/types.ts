import type { AppointmentSourceValue, AppointmentStatusValue } from "./statuses.js";

export interface SlotOption {
  key: string;
  serviceId: string;
  specialistId: string;
  specialistName: string;
  serviceName: string;
  startAt: Date;
  endAt: Date;
  price: number;
  durationMinutes: number;
}

export interface CreateAppointmentInput {
  clientName: string;
  clientPhone?: string;
  telegramId?: string;
  serviceId: string;
  specialistId: string;
  startAt: Date;
  source: AppointmentSourceValue;
  comment?: string;
}

export interface ManualAppointmentInput extends CreateAppointmentInput {
  source: AppointmentSourceValue;
}

export interface AppointmentFilters {
  date?: string;
  dateFrom?: Date;
  dateTo?: Date;
  specialistId?: string;
  serviceId?: string;
  status?: AppointmentStatusValue;
  search?: string;
}

export interface ParsedIntent {
  type: string;
  serviceName?: string;
  dateText?: string;
  periodText?: string;
  specialistName?: string;
  confidence: number;
  rawText: string;
}
