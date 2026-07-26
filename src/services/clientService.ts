import { ClientRepository } from "../repositories/clientRepository.js";

export class ClientService {
  constructor(private readonly clients: ClientRepository) {}

  findByTelegramId(telegramId: string) {
    return this.clients.findByTelegramId(telegramId);
  }

  findByPhone(phone: string) {
    return this.clients.findByPhone(phone);
  }

  list(search?: string) {
    return this.clients.findMany(search);
  }

  upsertClient(input: { name: string; phone?: string; telegramId?: string }) {
    return this.clients.upsertClient(input);
  }

  incrementAppointmentStats(clientId: string, startAt: Date) {
    return this.clients.incrementAppointmentStats(clientId, startAt);
  }
}
