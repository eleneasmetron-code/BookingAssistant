import type { Appointment, Client, LogEntry, ServiceItem, Setting, SlotOption, Specialist } from "./types";

const getSecret = () => localStorage.getItem("adminSecret") ?? "";

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": getSecret(),
      ...(options.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Ошибка запроса");
  }

  return (await response.json()) as T;
};

export const api = {
  dashboard: () =>
    request<{
      appointmentsToday: number;
      servicesActive: number;
      specialistsActive: number;
      recentLogs: LogEntry[];
    }>("/api/dashboard"),
  appointments: (query = "") => request<Appointment[]>(`/api/appointments${query}`),
  createAppointment: (body: unknown) =>
    request<Appointment>("/api/appointments", { method: "POST", body: JSON.stringify(body) }),
  slots: (query: { serviceId: string; date: string; specialistId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    params.set("serviceId", query.serviceId);
    params.set("date", query.date);
    if (query.specialistId) params.set("specialistId", query.specialistId);
    if (query.limit) params.set("limit", String(query.limit));
    return request<SlotOption[]>(`/api/slots?${params}`);
  },
  setAppointmentStatus: (id: string, status: string) =>
    request<Appointment>(`/api/appointments/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  cancelAppointment: (id: string) =>
    request<Appointment>(`/api/appointments/${id}/cancel`, { method: "POST" }),
  services: () => request<ServiceItem[]>("/api/services"),
  createService: (body: unknown) =>
    request<ServiceItem>("/api/services", { method: "POST", body: JSON.stringify(body) }),
  updateService: (id: string, body: unknown) =>
    request<ServiceItem>(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  specialists: () => request<Specialist[]>("/api/specialists"),
  createSpecialist: (body: unknown) =>
    request<Specialist>("/api/specialists", { method: "POST", body: JSON.stringify(body) }),
  updateSpecialist: (id: string, body: unknown) =>
    request<Specialist>(`/api/specialists/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  assignSpecialistService: (specialistId: string, serviceId: string) =>
    request<unknown>(`/api/specialists/${specialistId}/services`, {
      method: "POST",
      body: JSON.stringify({ serviceId })
    }),
  unassignSpecialistService: (specialistId: string, serviceId: string) =>
    request<unknown>(`/api/specialists/${specialistId}/services/${serviceId}`, {
      method: "DELETE"
    }),
  addWorkingHour: (specialistId: string, body: unknown) =>
    request<unknown>(`/api/specialists/${specialistId}/working-hours`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  addBreak: (specialistId: string, body: unknown) =>
    request<unknown>(`/api/specialists/${specialistId}/breaks`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  clients: (search = "") => request<Client[]>(`/api/clients${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createTimeBlock: (body: unknown) =>
    request<unknown>("/api/time-blocks", { method: "POST", body: JSON.stringify(body) }),
  logs: () => request<LogEntry[]>("/api/logs"),
  settings: () => request<Setting[]>("/api/settings"),
  updateSetting: (body: unknown) =>
    request<Setting>("/api/settings", { method: "PATCH", body: JSON.stringify(body) }),
  sendTestReminder: () =>
    request<{ sent: boolean; message: string }>("/api/reminders/test-send", { method: "POST" })
};
