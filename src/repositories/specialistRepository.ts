import type { PrismaClient } from "@prisma/client";

export class SpecialistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findActive() {
    return this.prisma.specialist.findMany({
      where: { isActive: true },
      include: {
        services: { include: { service: true } },
        workingHours: true,
        breaks: true,
        timeBlocks: true
      },
      orderBy: { name: "asc" }
    });
  }

  findAll() {
    return this.prisma.specialist.findMany({
      include: {
        services: { include: { service: true } },
        workingHours: true,
        breaks: true,
        timeBlocks: true
      },
      orderBy: { name: "asc" }
    });
  }

  findById(id: string) {
    return this.prisma.specialist.findUnique({
      where: { id },
      include: {
        services: { include: { service: true } },
        workingHours: true,
        breaks: true,
        timeBlocks: true
      }
    });
  }

  findByService(serviceId: string) {
    return this.prisma.specialist.findMany({
      where: {
        isActive: true,
        services: { some: { serviceId } }
      },
      include: {
        services: { include: { service: true } },
        workingHours: true,
        breaks: true,
        timeBlocks: true
      },
      orderBy: { name: "asc" }
    });
  }

  create(data: { name: string; position: string; adminComment?: string; isActive?: boolean }) {
    return this.prisma.specialist.create({ data });
  }

  update(
    id: string,
    data: Partial<{ name: string; position: string; adminComment: string; isActive: boolean }>
  ) {
    return this.prisma.specialist.update({ where: { id }, data });
  }

  createTimeBlock(data: {
    specialistId: string;
    date: string;
    startTime: string;
    endTime: string;
    reason: string;
    createdBy: string;
  }) {
    return this.prisma.timeBlock.create({ data });
  }

  createWorkingHour(data: {
    specialistId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) {
    return this.prisma.workingHour.create({ data });
  }

  createBreak(data: {
    specialistId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    reason?: string;
  }) {
    return this.prisma.breakTime.create({ data });
  }

  assignService(specialistId: string, serviceId: string) {
    return this.prisma.specialistService.upsert({
      where: { specialistId_serviceId: { specialistId, serviceId } },
      create: { specialistId, serviceId },
      update: {}
    });
  }

  unassignService(specialistId: string, serviceId: string) {
    return this.prisma.specialistService.delete({
      where: { specialistId_serviceId: { specialistId, serviceId } }
    });
  }
}
