import type { PrismaClient } from "@prisma/client";

export class SettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll() {
    return this.prisma.setting.findMany({ orderBy: { key: "asc" } });
  }

  findByKey(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  upsert(key: string, value: string, description?: string) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value, description },
      update: { value, description }
    });
  }
}
