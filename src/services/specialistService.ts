import { NotFoundError } from "../domain/errors.js";
import { SpecialistRepository } from "../repositories/specialistRepository.js";

export class SpecialistService {
  constructor(private readonly specialists: SpecialistRepository) {}

  listActive() {
    return this.specialists.findActive();
  }

  listAll() {
    return this.specialists.findAll();
  }

  async getById(id: string) {
    const specialist = await this.specialists.findById(id);
    if (!specialist) {
      throw new NotFoundError("Специалист");
    }

    return specialist;
  }

  findByService(serviceId: string) {
    return this.specialists.findByService(serviceId);
  }

  create(input: { name: string; position: string; adminComment?: string; isActive?: boolean }) {
    return this.specialists.create(input);
  }

  update(
    id: string,
    input: Partial<{ name: string; position: string; adminComment: string; isActive: boolean }>
  ) {
    return this.specialists.update(id, input);
  }

  addTimeBlock(input: {
    specialistId: string;
    date: string;
    startTime: string;
    endTime: string;
    reason: string;
    createdBy: string;
  }) {
    return this.specialists.createTimeBlock(input);
  }

  addWorkingHour(input: {
    specialistId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) {
    return this.specialists.createWorkingHour(input);
  }

  addBreak(input: {
    specialistId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    reason?: string;
  }) {
    return this.specialists.createBreak(input);
  }

  assignService(specialistId: string, serviceId: string) {
    return this.specialists.assignService(specialistId, serviceId);
  }

  unassignService(specialistId: string, serviceId: string) {
    return this.specialists.unassignService(specialistId, serviceId);
  }
}
