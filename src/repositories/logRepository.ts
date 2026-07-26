import type { PrismaClient } from "@prisma/client";

export class LogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: {
    level: string;
    source: string;
    action: string;
    description: string;
    data?: string | null;
  }) {
    return this.prisma.logEntry.create({ data });
  }

  findRecent(limit = 100) {
    return this.prisma.logEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }
}
