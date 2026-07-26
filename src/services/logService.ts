import { LogRepository } from "../repositories/logRepository.js";
import { stringifySafe } from "../utils/json.js";

export class LogService {
  constructor(private readonly logs: LogRepository) {}

  info(source: string, action: string, description: string, data?: unknown) {
    return this.logs.create({
      level: "info",
      source,
      action,
      description,
      data: data === undefined ? null : stringifySafe(data)
    });
  }

  warning(source: string, action: string, description: string, data?: unknown) {
    return this.logs.create({
      level: "warning",
      source,
      action,
      description,
      data: data === undefined ? null : stringifySafe(data)
    });
  }

  error(source: string, action: string, description: string, data?: unknown) {
    return this.logs.create({
      level: "error",
      source,
      action,
      description,
      data: data === undefined ? null : stringifySafe(data)
    });
  }

  recent(limit = 100) {
    return this.logs.findRecent(limit);
  }
}
