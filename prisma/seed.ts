import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { addDays, addMinutes, format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { AppointmentSource, AppointmentStatus } from "../src/domain/statuses.js";

const prisma = new PrismaClient();
const timezone = process.env.APP_TIMEZONE ?? "UTC";

const localDateTimeToUtc = (dateKey: string, time: string) =>
  fromZonedTime(`${dateKey}T${time}:00`, timezone);

const dateKey = (offsetDays: number) => format(addDays(new Date(), offsetDays), "yyyy-MM-dd");

async function main() {
  const services = await Promise.all([
    prisma.serviceItem.upsert({
      where: { name: "массаж спины" },
      create: {
        name: "массаж спины",
        durationMinutes: 40,
        price: 2000,
        description: "Расслабляющий массаж спины для снятия напряжения.",
        bufferAfter: 10
      },
      update: {
        durationMinutes: 40,
        price: 2000,
        description: "Расслабляющий массаж спины для снятия напряжения.",
        isActive: true
      }
    }),
    prisma.serviceItem.upsert({
      where: { name: "общий массаж" },
      create: {
        name: "общий массаж",
        durationMinutes: 90,
        price: 4500,
        description: "Полный массаж тела, длительная процедура для восстановления.",
        bufferAfter: 10
      },
      update: {
        durationMinutes: 90,
        price: 4500,
        description: "Полный массаж тела, длительная процедура для восстановления.",
        isActive: true
      }
    }),
    prisma.serviceItem.upsert({
      where: { name: "чистка лица" },
      create: {
        name: "чистка лица",
        durationMinutes: 60,
        price: 3500,
        description: "Косметологическая процедура очищения кожи лица.",
        bufferAfter: 15
      },
      update: {
        durationMinutes: 60,
        price: 3500,
        description: "Косметологическая процедура очищения кожи лица.",
        isActive: true
      }
    }),
    prisma.serviceItem.upsert({
      where: { name: "консультация косметолога" },
      create: {
        name: "консультация косметолога",
        durationMinutes: 30,
        price: 1500,
        description: "Консультация по уходу и подбору процедуры.",
        bufferAfter: 5
      },
      update: {
        durationMinutes: 30,
        price: 1500,
        description: "Консультация по уходу и подбору процедуры.",
        isActive: true
      }
    }),
    prisma.serviceItem.upsert({
      where: { name: "уходовая процедура" },
      create: {
        name: "уходовая процедура",
        durationMinutes: 75,
        price: 4000,
        description: "Мягкая уходовая процедура для кожи лица.",
        bufferAfter: 10
      },
      update: {
        durationMinutes: 75,
        price: 4000,
        description: "Мягкая уходовая процедура для кожи лица.",
        isActive: true
      }
    }),
    prisma.serviceItem.upsert({
      where: { name: "коррекция бровей" },
      create: {
        name: "коррекция бровей",
        durationMinutes: 30,
        price: 1200,
        description: "Коррекция формы бровей.",
        bufferAfter: 5
      },
      update: {
        durationMinutes: 30,
        price: 1200,
        description: "Коррекция формы бровей.",
        isActive: true
      }
    })
  ]);

  const byName = Object.fromEntries(services.map((service) => [service.name, service]));

  const ekaterina = await prisma.specialist.upsert({
    where: { name: "Екатерина" },
    create: {
      name: "Екатерина",
      position: "косметолог",
      adminComment: "Делает процедуры по лицу и консультации."
    },
    update: {
      position: "косметолог",
      adminComment: "Делает процедуры по лицу и консультации.",
      isActive: true
    }
  });

  const sergey = await prisma.specialist.upsert({
    where: { name: "Сергей" },
    create: {
      name: "Сергей",
      position: "массажист",
      adminComment: "Основной специалист по массажу."
    },
    update: {
      position: "массажист",
      adminComment: "Основной специалист по массажу.",
      isActive: true
    }
  });

  const olga = await prisma.specialist.upsert({
    where: { name: "Ольга" },
    create: {
      name: "Ольга",
      position: "мастер бровей и ухода",
      adminComment: "Брови и базовые уходовые процедуры."
    },
    update: {
      position: "мастер бровей и ухода",
      adminComment: "Брови и базовые уходовые процедуры.",
      isActive: true
    }
  });

  await prisma.specialistService.deleteMany({
    where: { specialistId: { in: [ekaterina.id, sergey.id, olga.id] } }
  });

  await prisma.specialistService.createMany({
    data: [
      { specialistId: ekaterina.id, serviceId: byName["чистка лица"].id },
      { specialistId: ekaterina.id, serviceId: byName["консультация косметолога"].id },
      { specialistId: ekaterina.id, serviceId: byName["уходовая процедура"].id },
      { specialistId: sergey.id, serviceId: byName["массаж спины"].id },
      { specialistId: sergey.id, serviceId: byName["общий массаж"].id },
      { specialistId: olga.id, serviceId: byName["коррекция бровей"].id },
      { specialistId: olga.id, serviceId: byName["уходовая процедура"].id }
    ]
  });

  await prisma.workingHour.deleteMany({ where: { specialistId: { in: [ekaterina.id, sergey.id, olga.id] } } });
  await prisma.breakTime.deleteMany({ where: { specialistId: { in: [ekaterina.id, sergey.id, olga.id] } } });
  await prisma.timeBlock.deleteMany({ where: { specialistId: { in: [ekaterina.id, sergey.id, olga.id] } } });

  await prisma.workingHour.createMany({
    data: [
      { specialistId: ekaterina.id, dayOfWeek: 1, startTime: "10:00", endTime: "19:00" },
      { specialistId: ekaterina.id, dayOfWeek: 3, startTime: "10:00", endTime: "19:00" },
      { specialistId: ekaterina.id, dayOfWeek: 5, startTime: "10:00", endTime: "19:00" },
      { specialistId: sergey.id, dayOfWeek: 2, startTime: "12:00", endTime: "21:00" },
      { specialistId: sergey.id, dayOfWeek: 3, startTime: "12:00", endTime: "21:00" },
      { specialistId: sergey.id, dayOfWeek: 4, startTime: "12:00", endTime: "21:00" },
      { specialistId: sergey.id, dayOfWeek: 5, startTime: "12:00", endTime: "21:00" },
      { specialistId: sergey.id, dayOfWeek: 6, startTime: "12:00", endTime: "21:00" },
      { specialistId: olga.id, dayOfWeek: 1, startTime: "11:00", endTime: "18:00" },
      { specialistId: olga.id, dayOfWeek: 2, startTime: "11:00", endTime: "18:00" },
      { specialistId: olga.id, dayOfWeek: 3, startTime: "11:00", endTime: "18:00" },
      { specialistId: olga.id, dayOfWeek: 4, startTime: "11:00", endTime: "18:00" },
      { specialistId: olga.id, dayOfWeek: 5, startTime: "11:00", endTime: "18:00" },
      { specialistId: olga.id, dayOfWeek: 6, startTime: "11:00", endTime: "18:00" }
    ]
  });

  await prisma.breakTime.createMany({
    data: [
      { specialistId: ekaterina.id, dayOfWeek: 1, startTime: "14:00", endTime: "15:00", reason: "обед" },
      { specialistId: ekaterina.id, dayOfWeek: 3, startTime: "14:00", endTime: "15:00", reason: "обед" },
      { specialistId: ekaterina.id, dayOfWeek: 5, startTime: "14:00", endTime: "15:00", reason: "обед" }
    ]
  });

  await prisma.timeBlock.create({
    data: {
      specialistId: sergey.id,
      date: dateKey(2),
      startTime: "16:00",
      endTime: "17:00",
      reason: "личная блокировка",
      createdBy: "seed"
    }
  });

  const clients = [
    {
      name: "Анна",
      phone: "+79990000001",
      telegramId: "100000001",
      city: "Москва",
      appointmentCount: 3
    },
    {
      name: "Ирина",
      phone: "+79990000002",
      telegramId: "100000002",
      city: "Санкт-Петербург",
      appointmentCount: 2
    },
    {
      name: "Елена",
      phone: "+79990000003",
      telegramId: "100000003",
      city: "Новосибирск",
      appointmentCount: 1
    },
    {
      name: "Ольга",
      phone: "+79990000004",
      telegramId: "100000004",
      city: "Екатеринбург",
      appointmentCount: 2
    },
    {
      name: "Татьяна",
      phone: "+79990000005",
      telegramId: "100000005",
      city: "Казань",
      appointmentCount: 4
    },
    {
      name: "Мария",
      phone: "+79990000006",
      telegramId: "100000006",
      city: "Краснодар",
      appointmentCount: 1
    },
    {
      name: "Наталья",
      phone: "+79990000007",
      telegramId: "100000007",
      city: "Владивосток",
      appointmentCount: 2
    },
    {
      name: "Юлия",
      phone: "+79990000008",
      telegramId: "100000008",
      city: "Ростов-на-Дону",
      appointmentCount: 3
    }
  ];

  const createdClients = await Promise.all(
    clients.map(client => prisma.client.upsert({
      where: { telegramId: client.telegramId },
      create: {
        name: client.name,
        phone: client.phone,
        telegramId: client.telegramId,
        firstVisitAt: new Date(),
        appointmentCount: client.appointmentCount
      },
      update: {
        name: client.name,
        phone: client.phone,
        appointmentCount: client.appointmentCount
      }
    }))
  );

  const byClientName = Object.fromEntries(createdClients.map(client => [client.name, client]));

  await prisma.appointment.deleteMany({
    where: {
      source: AppointmentSource.Manual,
      clientId: { in: createdClients.map(c => c.id) }
    }
  });

  const today = dateKey(0);
  const tomorrow = dateKey(1);

  const appointments = [
    {
      clientId: byClientName["Анна"].id,
      serviceId: byName["массаж спины"].id,
      specialistId: sergey.id,
      startAt: localDateTimeToUtc(today, "09:00"),
      endAt: addMinutes(localDateTimeToUtc(today, "09:00"), 40),
      status: AppointmentStatus.Confirmed,
      source: AppointmentSource.Manual,
      clientNameSnapshot: "Анна",
      clientPhoneSnapshot: "+79990000001",
      comment: "Массаж спины - Москва"
    },
    {
      clientId: byClientName["Ирина"].id,
      serviceId: byName["чистка лица"].id,
      specialistId: ekaterina.id,
      startAt: localDateTimeToUtc(today, "10:30"),
      endAt: addMinutes(localDateTimeToUtc(today, "10:30"), 60),
      status: AppointmentStatus.Confirmed,
      source: AppointmentSource.Manual,
      clientNameSnapshot: "Ирина",
      clientPhoneSnapshot: "+79990000002",
      comment: "Чистка лица - Санкт-Петербург"
    },
    {
      clientId: byClientName["Елена"].id,
      serviceId: byName["консультация косметолога"].id,
      specialistId: ekaterina.id,
      startAt: localDateTimeToUtc(today, "12:00"),
      endAt: addMinutes(localDateTimeToUtc(today, "12:00"), 30),
      status: AppointmentStatus.NeedsAttention,
      source: AppointmentSource.Manual,
      clientNameSnapshot: "Елена",
      clientPhoneSnapshot: "+79990000003",
      comment: "Консультация - Новосибирск"
    },
    {
      clientId: byClientName["Ольга"].id,
      serviceId: byName["общий массаж"].id,
      specialistId: sergey.id,
      startAt: localDateTimeToUtc(today, "14:00"),
      endAt: addMinutes(localDateTimeToUtc(today, "14:00"), 90),
      status: AppointmentStatus.Confirmed,
      source: AppointmentSource.Manual,
      clientNameSnapshot: "Ольга",
      clientPhoneSnapshot: "+79990000004",
      comment: "Общий массаж - Екатеринбург"
    },
    {
      clientId: byClientName["Татьяна"].id,
      serviceId: byName["уходовая процедура"].id,
      specialistId: ekaterina.id,
      startAt: localDateTimeToUtc(today, "16:00"),
      endAt: addMinutes(localDateTimeToUtc(today, "16:00"), 75),
      status: AppointmentStatus.Confirmed,
      source: AppointmentSource.Manual,
      clientNameSnapshot: "Татьяна",
      clientPhoneSnapshot: "+79990000005",
      comment: "Уходовая процедура - Казань"
    },
    {
      clientId: byClientName["Мария"].id,
      serviceId: byName["коррекция бровей"].id,
      specialistId: olga.id,
      startAt: localDateTimeToUtc(today, "17:30"),
      endAt: addMinutes(localDateTimeToUtc(today, "17:30"), 30),
      status: AppointmentStatus.Confirmed,
      source: AppointmentSource.Manual,
      clientNameSnapshot: "Мария",
      clientPhoneSnapshot: "+79990000006",
      comment: "Коррекция бровей - Краснодар"
    },
    {
      clientId: byClientName["Наталья"].id,
      serviceId: byName["массаж спины"].id,
      specialistId: sergey.id,
      startAt: localDateTimeToUtc(today, "19:00"),
      endAt: addMinutes(localDateTimeToUtc(today, "19:00"), 40),
      status: AppointmentStatus.Confirmed,
      source: AppointmentSource.Manual,
      clientNameSnapshot: "Наталья",
      clientPhoneSnapshot: "+79990000007",
      comment: "Массаж спины - Владивосток"
    },
    {
      clientId: byClientName["Юлия"].id,
      serviceId: byName["чистка лица"].id,
      specialistId: ekaterina.id,
      startAt: localDateTimeToUtc(tomorrow, "11:00"),
      endAt: addMinutes(localDateTimeToUtc(tomorrow, "11:00"), 60),
      status: AppointmentStatus.Confirmed,
      source: AppointmentSource.Manual,
      clientNameSnapshot: "Юлия",
      clientPhoneSnapshot: "+79990000008",
      comment: "Чистка лица - Ростов-на-Дону"
    }
  ];

  await prisma.appointment.createMany({
    data: appointments
  });

  const settings = {
    studio_address: process.env.STUDIO_ADDRESS ?? "г. Лунарск, демо-студия, ул. Рассветная 10",
    studio_landmark: process.env.STUDIO_LANDMARK ?? "Ориентир: стеклянная арка у входа",
    studio_visit_rules:
      process.env.STUDIO_VISIT_RULES ?? "Пожалуйста, приходите за 10 минут до начала",
    timezone,
    admin_working_hours: "09:00-20:00",
    confirmation_text: "Готово, вы записаны. За день и за 2 часа я напомню о визите.",
    reminder_24h_text:
      "Напоминаем: завтра у вас запись. Если не сможете прийти, пожалуйста, отмените или перенесите запись заранее.",
    reminder_2h_text: "Ждём вас сегодня. Если задерживаетесь, напишите администратору.",
    late_cancel_hours: process.env.LATE_CANCEL_HOURS ?? "3"
  };

  await Promise.all(
    Object.entries(settings).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value }
      })
    )
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Демо-данные добавлены.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

