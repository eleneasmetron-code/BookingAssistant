import { NotFoundError } from "../domain/errors.js";
import { ServiceRepository } from "../repositories/serviceRepository.js";

export class ServiceCatalog {
  constructor(private readonly services: ServiceRepository) {}

  listActive() {
    return this.services.findActive();
  }

  listAll() {
    return this.services.findAll();
  }

  async getById(id: string) {
    const service = await this.services.findById(id);
    if (!service) {
      throw new NotFoundError("Услуга");
    }

    return service;
  }

  async findByClientText(text: string) {
    const services = await this.services.findActive();
    const normalized = text.toLowerCase();

    return (
      services.find((service) => normalized.includes(service.name.toLowerCase())) ??
      services.find((service) =>
        service.name
          .toLowerCase()
          .split(" ")
          .filter((part) => part.length > 3)
          .some((part) => normalized.includes(part))
      ) ??
      null
    );
  }

  create(input: {
    name: string;
    durationMinutes: number;
    price: number;
    description: string;
    isActive?: boolean;
    prepaymentEnabled?: boolean;
    bufferBefore?: number;
    bufferAfter?: number;
  }) {
    return this.services.create(input);
  }

  update(
    id: string,
    input: Partial<{
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
    return this.services.update(id, input);
  }
}
