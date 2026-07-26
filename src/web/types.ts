export interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description: string;
  isActive: boolean;
  bufferBefore: number;
  bufferAfter: number;
}

export interface Specialist {
  id: string;
  name: string;
  position: string;
  isActive: boolean;
  adminComment?: string | null;
  services?: Array<{ service: ServiceItem }>;
  workingHours?: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  breaks?: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    reason?: string | null;
  }>;
  timeBlocks?: Array<{
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    reason: string;
  }>;
}

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  telegramId?: string | null;
  appointmentCount: number;
  needsAttention: boolean;
}

export interface Appointment {
  id: string;
  clientNameSnapshot: string;
  clientPhoneSnapshot?: string | null;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  comment?: string | null;
  client: Client;
  service: ServiceItem;
  specialist: Specialist;
}

export interface LogEntry {
  id: string;
  level: string;
  source: string;
  action: string;
  description: string;
  data?: string | null;
  createdAt: string;
}

export interface SlotOption {
  key: string;
  serviceId: string;
  specialistId: string;
  specialistName: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  price: number;
  durationMinutes: number;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description?: string | null;
}
