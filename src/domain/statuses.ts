export const AppointmentStatus = {
  Confirmed: "confirmed",
  Canceled: "canceled",
  Rescheduled: "rescheduled",
  Completed: "completed",
  NoShow: "no_show",
  NeedsAttention: "needs_attention"
} as const;

export type AppointmentStatusValue = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const activeAppointmentStatuses: AppointmentStatusValue[] = [
  AppointmentStatus.Confirmed,
  AppointmentStatus.NeedsAttention
];

export const AppointmentSource = {
  TelegramBot: "telegram_bot",
  Manual: "manual",
  Instagram: "instagram",
  Phone: "phone",
  Other: "other"
} as const;

export type AppointmentSourceValue = (typeof AppointmentSource)[keyof typeof AppointmentSource];

export const ReminderStatus = {
  Planned: "planned",
  Sent: "sent",
  Failed: "failed",
  Canceled: "canceled"
} as const;

export type ReminderStatusValue = (typeof ReminderStatus)[keyof typeof ReminderStatus];

export const ReminderType = {
  DayBefore: "24h",
  TwoHoursBefore: "2h"
} as const;

export type ReminderTypeValue = (typeof ReminderType)[keyof typeof ReminderType];

export const ConversationStep = {
  Idle: "idle",
  ChoosingService: "choosing_service",
  ChoosingDate: "choosing_date",
  ChoosingTime: "choosing_time",
  EnteringName: "entering_name",
  EnteringPhone: "entering_phone",
  ConfirmingBooking: "confirming_booking",
  Canceling: "canceling",
  Rescheduling: "rescheduling",
  WaitingAdmin: "waiting_admin"
} as const;

export type ConversationStepValue = (typeof ConversationStep)[keyof typeof ConversationStep];

export const IntentType = {
  Booking: "booking",
  PriceQuestion: "price_question",
  ServiceQuestion: "service_question",
  Cancel: "cancel",
  Reschedule: "reschedule",
  Complaint: "complaint",
  AdminRequest: "admin_request",
  MedicalQuestion: "medical_question",
  Unknown: "unknown"
} as const;

export type IntentTypeValue = (typeof IntentType)[keyof typeof IntentType];
