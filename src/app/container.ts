import { configService } from "../config/configService.js";
import { prisma } from "../db/prisma.js";
import { AppointmentRepository } from "../repositories/appointmentRepository.js";
import { ClientRepository } from "../repositories/clientRepository.js";
import { ConversationRepository } from "../repositories/conversationRepository.js";
import { LogRepository } from "../repositories/logRepository.js";
import { ReminderRepository } from "../repositories/reminderRepository.js";
import { ServiceRepository } from "../repositories/serviceRepository.js";
import { SettingsRepository } from "../repositories/settingsRepository.js";
import { SpecialistRepository } from "../repositories/specialistRepository.js";
import { AdminNotificationService } from "../services/adminNotificationService.js";
import { BookingService } from "../services/bookingService.js";
import { ClientService } from "../services/clientService.js";
import { ConversationService } from "../services/conversationService.js";
import { IntentService } from "../services/intentService.js";
import { LogService } from "../services/logService.js";
import { ReminderService } from "../services/reminderService.js";
import { ServiceCatalog } from "../services/serviceCatalog.js";
import { SettingsService } from "../services/settingsService.js";
import { SlotService } from "../services/slotService.js";
import { SpecialistService } from "../services/specialistService.js";

const logRepository = new LogRepository(prisma);
const serviceRepository = new ServiceRepository(prisma);
const specialistRepository = new SpecialistRepository(prisma);
const appointmentRepository = new AppointmentRepository(prisma);
const clientRepository = new ClientRepository(prisma);
const conversationRepository = new ConversationRepository(prisma);
const settingsRepository = new SettingsRepository(prisma);
const reminderRepository = new ReminderRepository(prisma);

const logService = new LogService(logRepository);
const serviceCatalog = new ServiceCatalog(serviceRepository);
const specialistService = new SpecialistService(specialistRepository);
const clientService = new ClientService(clientRepository);
const settingsService = new SettingsService(settingsRepository, configService);
const reminderService = new ReminderService(configService, reminderRepository, settingsService, logService);
const adminNotificationService = new AdminNotificationService(configService, logService);
const slotService = new SlotService(
  configService,
  serviceCatalog,
  specialistService,
  appointmentRepository
);
const bookingService = new BookingService(
  prisma,
  configService,
  appointmentRepository,
  clientService,
  serviceCatalog,
  slotService,
  reminderService,
  adminNotificationService,
  logService
);
const intentService = new IntentService(configService, serviceCatalog, logService);
const conversationService = new ConversationService(conversationRepository);

export const appContainer = {
  config: configService,
  prisma,
  logService,
  serviceCatalog,
  specialistService,
  clientService,
  settingsService,
  reminderService,
  adminNotificationService,
  slotService,
  bookingService,
  intentService,
  conversationService
};
