import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbPath = resolve("prisma/dev.db");
mkdirSync(dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS "Client" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "telegramId" TEXT,
  "firstVisitAt" DATETIME,
  "lastVisitAt" DATETIME,
  "appointmentCount" INTEGER NOT NULL DEFAULT 0,
  "adminComment" TEXT,
  "needsAttention" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Client_telegramId_key" ON "Client"("telegramId");
CREATE INDEX IF NOT EXISTS "Client_phone_idx" ON "Client"("phone");

CREATE TABLE IF NOT EXISTS "ServiceItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "prepaymentEnabled" BOOLEAN NOT NULL DEFAULT false,
  "bufferBefore" INTEGER NOT NULL DEFAULT 0,
  "bufferAfter" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceItem_name_key" ON "ServiceItem"("name");

CREATE TABLE IF NOT EXISTS "Specialist" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "adminComment" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Specialist_name_key" ON "Specialist"("name");

CREATE TABLE IF NOT EXISTS "SpecialistService" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "specialistId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "SpecialistService_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpecialistService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SpecialistService_specialistId_serviceId_key" ON "SpecialistService"("specialistId", "serviceId");
CREATE INDEX IF NOT EXISTS "SpecialistService_serviceId_idx" ON "SpecialistService"("serviceId");

CREATE TABLE IF NOT EXISTS "WorkingHour" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "specialistId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  CONSTRAINT "WorkingHour_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WorkingHour_specialistId_dayOfWeek_idx" ON "WorkingHour"("specialistId", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "BreakTime" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "specialistId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "reason" TEXT,
  CONSTRAINT "BreakTime_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BreakTime_specialistId_dayOfWeek_idx" ON "BreakTime"("specialistId", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "TimeBlock" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "specialistId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimeBlock_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TimeBlock_specialistId_date_idx" ON "TimeBlock"("specialistId", "date");

CREATE TABLE IF NOT EXISTS "Appointment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "specialistId" TEXT NOT NULL,
  "startAt" DATETIME NOT NULL,
  "endAt" DATETIME NOT NULL,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "clientNameSnapshot" TEXT NOT NULL,
  "clientPhoneSnapshot" TEXT,
  "comment" TEXT,
  "confirmedByClientAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Appointment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Appointment_clientId_idx" ON "Appointment"("clientId");
CREATE INDEX IF NOT EXISTS "Appointment_specialistId_startAt_idx" ON "Appointment"("specialistId", "startAt");
CREATE INDEX IF NOT EXISTS "Appointment_serviceId_idx" ON "Appointment"("serviceId");
CREATE INDEX IF NOT EXISTS "Appointment_status_idx" ON "Appointment"("status");

CREATE TABLE IF NOT EXISTS "AppointmentTransfer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "oldAppointmentId" TEXT NOT NULL,
  "newAppointmentId" TEXT NOT NULL,
  "oldStartAt" DATETIME NOT NULL,
  "newStartAt" DATETIME NOT NULL,
  "movedBy" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentTransfer_oldAppointmentId_fkey" FOREIGN KEY ("oldAppointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AppointmentTransfer_newAppointmentId_fkey" FOREIGN KEY ("newAppointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ConversationMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT,
  "telegramId" TEXT,
  "direction" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "selectedServiceId" TEXT,
  "selectedStartAt" DATETIME,
  "actionType" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ConversationMessage_telegramId_createdAt_idx" ON "ConversationMessage"("telegramId", "createdAt");

CREATE TABLE IF NOT EXISTS "ConversationState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "telegramId" TEXT NOT NULL,
  "clientId" TEXT,
  "step" TEXT NOT NULL,
  "selectedServiceId" TEXT,
  "selectedSpecialistId" TEXT,
  "selectedDate" TEXT,
  "selectedStartAt" DATETIME,
  "clientName" TEXT,
  "clientPhone" TEXT,
  "data" TEXT,
  "expiresAt" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationState_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationState_telegramId_key" ON "ConversationState"("telegramId");

CREATE TABLE IF NOT EXISTS "LogEntry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "level" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "data" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LogEntry_level_idx" ON "LogEntry"("level");
CREATE INDEX IF NOT EXISTS "LogEntry_createdAt_idx" ON "LogEntry"("createdAt");

CREATE TABLE IF NOT EXISTS "Setting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "description" TEXT,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Setting_key_key" ON "Setting"("key");

CREATE TABLE IF NOT EXISTS "Reminder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "appointmentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sendAt" DATETIME NOT NULL,
  "status" TEXT NOT NULL,
  "sentAt" DATETIME,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Reminder_sendAt_status_idx" ON "Reminder"("sendAt", "status");
CREATE INDEX IF NOT EXISTS "Reminder_appointmentId_idx" ON "Reminder"("appointmentId");
`);

db.close();
console.log(`SQLite-база готова: ${dbPath}`);
