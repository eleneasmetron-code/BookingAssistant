import cors from "cors";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { AppointmentSource, AppointmentStatus } from "../domain/statuses.js";
import { getUserMessage } from "../domain/errors.js";
import { localDateTimeToUtc } from "../utils/dateTime.js";
import { createAdminAuth } from "./auth.js";
import type { appContainer } from "../app/container.js";

type Container = typeof appContainer;

const serviceSchema = z.object({
  name: z.string().min(2),
  durationMinutes: z.coerce.number().int().positive(),
  price: z.coerce.number().int().nonnegative(),
  description: z.string().min(1),
  isActive: z.boolean().optional(),
  prepaymentEnabled: z.boolean().optional(),
  bufferBefore: z.coerce.number().int().nonnegative().optional(),
  bufferAfter: z.coerce.number().int().nonnegative().optional()
});

const specialistSchema = z.object({
  name: z.string().min(2),
  position: z.string().min(2),
  adminComment: z.string().optional(),
  isActive: z.boolean().optional()
});

const sourceSchema = z.enum([
  AppointmentSource.TelegramBot,
  AppointmentSource.Manual,
  AppointmentSource.Instagram,
  AppointmentSource.Phone,
  AppointmentSource.Other
]);

export const createAdminApi = (container: Container) => {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ ok: true, name: "Smart Booking Assistant" });
  });

  app.use("/api", createAdminAuth(container.config));

  app.get("/api/dashboard", async (_request, response, next) => {
    try {
      const [appointments, services, specialists, logs] = await Promise.all([
        container.bookingService.list({}),
        container.serviceCatalog.listAll(),
        container.specialistService.listAll(),
        container.logService.recent(20)
      ]);

      response.json({
        appointmentsToday: appointments.filter((item) => item.status === AppointmentStatus.Confirmed).length,
        servicesActive: services.filter((item) => item.isActive).length,
        specialistsActive: specialists.filter((item) => item.isActive).length,
        recentLogs: logs
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/appointments", async (request, response, next) => {
    try {
      const items = await container.bookingService.list({
        date: request.query.date?.toString(),
        specialistId: request.query.specialistId?.toString(),
        serviceId: request.query.serviceId?.toString(),
        status: request.query.status?.toString() as never,
        search: request.query.search?.toString()
      });
      response.json(items);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/appointments", async (request, response, next) => {
    try {
      const body = z
        .object({
          clientName: z.string().min(2),
          clientPhone: z.string().optional(),
          serviceId: z.string().min(1),
          specialistId: z.string().min(1),
          date: z.string().min(10),
          time: z.string().min(4),
          comment: z.string().optional(),
          source: sourceSchema.optional()
        })
        .parse(request.body);

      const created = await container.bookingService.createAppointment({
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        serviceId: body.serviceId,
        specialistId: body.specialistId,
        startAt: localDateTimeToUtc(body.date, body.time, container.config.timezone),
        source: body.source ?? AppointmentSource.Manual,
        comment: body.comment
      });

      response.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/slots", async (request, response, next) => {
    try {
      const query = z
        .object({
          serviceId: z.string().min(1),
          date: z.string().min(10),
          specialistId: z.string().optional(),
          limit: z.coerce.number().int().positive().max(50).optional()
        })
        .parse(request.query);

      const slots = await container.slotService.findSlots({
        serviceId: query.serviceId,
        date: query.date,
        specialistId: query.specialistId,
        limit: query.limit ?? 12
      });
      response.json(slots);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/appointments/:id/status", async (request, response, next) => {
    try {
      const body = z.object({ status: z.string() }).parse(request.body);
      const updated = await container.bookingService.updateAppointmentStatus(request.params.id, body.status);
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/appointments/:id/cancel", async (request, response, next) => {
    try {
      const updated = await container.bookingService.cancelAppointment(request.params.id, "admin", true);
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/appointments/:id/reschedule", async (request, response, next) => {
    try {
      const body = z.object({ specialistId: z.string(), date: z.string(), time: z.string() }).parse(request.body);
      const updated = await container.bookingService.rescheduleAppointment(
        request.params.id,
        body.specialistId,
        localDateTimeToUtc(body.date, body.time, container.config.timezone),
        "admin"
      );
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/services", async (_request, response, next) => {
    try {
      response.json(await container.serviceCatalog.listAll());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/services", async (request, response, next) => {
    try {
      response.status(201).json(await container.serviceCatalog.create(serviceSchema.parse(request.body)));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/services/:id", async (request, response, next) => {
    try {
      response.json(await container.serviceCatalog.update(request.params.id, serviceSchema.partial().parse(request.body)));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/specialists", async (_request, response, next) => {
    try {
      response.json(await container.specialistService.listAll());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/specialists", async (request, response, next) => {
    try {
      response.status(201).json(await container.specialistService.create(specialistSchema.parse(request.body)));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/specialists/:id", async (request, response, next) => {
    try {
      response.json(await container.specialistService.update(request.params.id, specialistSchema.partial().parse(request.body)));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/specialists/:id/services", async (request, response, next) => {
    try {
      const body = z.object({ serviceId: z.string().min(1) }).parse(request.body);
      response.status(201).json(await container.specialistService.assignService(request.params.id, body.serviceId));
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/specialists/:id/services/:serviceId", async (request, response, next) => {
    try {
      response.json(
        await container.specialistService.unassignService(request.params.id, request.params.serviceId)
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/time-blocks", async (request, response, next) => {
    try {
      const body = z
        .object({
          specialistId: z.string(),
          date: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          reason: z.string().min(2)
        })
        .parse(request.body);
      response.status(201).json(
        await container.specialistService.addTimeBlock({
          ...body,
          createdBy: "admin"
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/specialists/:id/working-hours", async (request, response, next) => {
    try {
      const body = z
        .object({
          dayOfWeek: z.coerce.number().int().min(0).max(6),
          startTime: z.string().min(4),
          endTime: z.string().min(4)
        })
        .parse(request.body);

      response.status(201).json(
        await container.specialistService.addWorkingHour({
          specialistId: request.params.id,
          ...body
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/specialists/:id/breaks", async (request, response, next) => {
    try {
      const body = z
        .object({
          dayOfWeek: z.coerce.number().int().min(0).max(6),
          startTime: z.string().min(4),
          endTime: z.string().min(4),
          reason: z.string().optional()
        })
        .parse(request.body);

      response.status(201).json(
        await container.specialistService.addBreak({
          specialistId: request.params.id,
          ...body
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/clients", async (request, response, next) => {
    try {
      response.json(await container.clientService.list(request.query.search?.toString()));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/logs", async (_request, response, next) => {
    try {
      response.json(await container.logService.recent(200));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/settings", async (_request, response, next) => {
    try {
      response.json(await container.settingsService.list());
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/settings", async (request, response, next) => {
    try {
      const body = z.object({ key: z.string(), value: z.string() }).parse(request.body);
      response.json(await container.settingsService.update(body.key, body.value));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reminders/test-send", async (_request, response, next) => {
    try {
      response.json(await container.reminderService.sendNextPlannedForTest());
    } catch (error) {
      next(error);
    }
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      response.status(400).json({ message: getUserMessage(error), technicalMessage: message });
    }
  );

  return app;
};
