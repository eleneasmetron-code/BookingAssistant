import type { PrismaClient } from "@prisma/client";

export class ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findActive() {
    return this.prisma.serviceItem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });
  }

  findAll() {
    return this.prisma.serviceItem.findMany({
      orderBy: { name: "asc" }
    });
  }

  findById(id: string) {
    return this.prisma.serviceItem.findUnique({
      where: { id },
      include: { specialists: { include: { specialist: true } } }
    });
  }

  findByNamePart(name: string) {
    return this.prisma.serviceItem.findFirst({
      where: {
        isActive: true,
        name: { contains: name }
      }
    });
  }

  create(data: {
    name: string;
    durationMinutes: number;
    price: number;
    description: string;
    isActive?: boolean;
    prepaymentEnabled?: boolean;
    bufferBefore?: number;
    bufferAfter?: number;
  }) {
    return this.prisma.serviceItem.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      durationMinutes: number;
      price: number;
      description: string;
      isActive: boolean;
      prepaymentEnabled: boolean;
      bufferBefore: number;
      bufferAfter: number;
    }>
  ) {
    return this.prisma.serviceItem.update({ where: { id }, data });
  }
}
