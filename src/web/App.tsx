import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  LogOut,
  Logs,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Appointment, Client, LogEntry, ServiceItem, Setting, SlotOption, Specialist } from "./types";

type Tab = "today" | "appointments" | "clients" | "services" | "specialists" | "settings" | "logs";

const statusLabels: Record<string, string> = {
  confirmed: "Подтверждена",
  canceled: "Отменена",
  rescheduled: "Перенесена",
  completed: "Пришёл",
  no_show: "Не пришёл",
  needs_attention: "Внимание"
};

const statusIcons: Record<string, string> = {
  confirmed: "✓",
  canceled: "✕",
  rescheduled: "↻",
  completed: "●",
  no_show: "○",
  needs_attention: "!"
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));

const todayInput = () => new Date().toISOString().slice(0, 10);
const dayLabels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge--${status.replace("_", "-")}`}>
      <span className="badge__dot">{statusIcons[status] ?? "·"}</span>
      {statusLabels[status] ?? status}
    </span>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="toast" onClick={onClose}>
      <span>{message}</span>
      <X size={14} />
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{title}</h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function App() {
  const [secret, setSecret] = useState(localStorage.getItem("adminSecret") ?? "");
  const [authorized, setAuthorized] = useState(Boolean(localStorage.getItem("adminSecret")));
  const [tab, setTab] = useState<Tab>("today");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(todayInput());
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [specialistFilter, setSpecialistFilter] = useState("");
  const [dashboard, setDashboard] = useState({ appointmentsToday: 0, servicesActive: 0, specialistsActive: 0 });

  const todayAppointments = useMemo(
    () =>
      appointments.filter((item) => {
        const d = new Date(item.startAt).toISOString().slice(0, 10);
        return d === todayInput() && (item.status === "confirmed" || item.status === "needs_attention");
      }),
    [appointments]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (dateFilter) query.set("date", dateFilter);
      if (statusFilter) query.set("status", statusFilter);
      if (serviceFilter) query.set("serviceId", serviceFilter);
      if (specialistFilter) query.set("specialistId", specialistFilter);
      if (search) query.set("search", search);

      const [apts, svcs, specs, cls, lgs, sets, dash] = await Promise.all([
        api.appointments(query.toString() ? `?${query}` : ""),
        api.services(),
        api.specialists(),
        api.clients(),
        api.logs(),
        api.settings(),
        api.dashboard()
      ]);

      setAppointments(apts);
      setServices(svcs);
      setSpecialists(specs);
      setClients(cls);
      setLogs(lgs);
      setSettings(sets);
      setDashboard(dash);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authorized) return;
    loadAll();
  }, [authorized, dateFilter, statusFilter, serviceFilter, specialistFilter]);

  const login = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem("adminSecret", secret);
    setAuthorized(true);
  };

  const logout = () => {
    localStorage.removeItem("adminSecret");
    setAuthorized(false);
    setSecret("");
  };

  const notify = (msg: string) => setToast(msg);
  const refresh = () => loadAll();

  if (!authorized) {
    return (
      <div className="login-screen">
        <form className="login-card" onSubmit={login}>
          <div className="login-card__logo">
            <div className="logo-mark">
              <Sparkles size={24} />
            </div>
          </div>
          <h1>Smart Booking</h1>
          <p className="login-card__subtitle">Панель управления AI-администратором</p>
          <div className="form-field">
            <label>Секрет доступа</label>
            <input
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              type="password"
              placeholder="Введите секрет"
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn--primary btn--full">
            Войти в панель
          </button>
        </form>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "today", label: "Сегодня", icon: <CalendarDays size={20} /> },
    { id: "appointments", label: "Записи", icon: <ClipboardList size={20} /> },
    { id: "clients", label: "Клиенты", icon: <UsersRound size={20} /> },
    { id: "services", label: "Услуги", icon: <Stethoscope size={20} /> },
    { id: "specialists", label: "Специалисты", icon: <UserRound size={20} /> },
    { id: "settings", label: "Настройки", icon: <Settings size={20} /> },
    { id: "logs", label: "Логи", icon: <Logs size={20} /> }
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="logo-mark logo-mark--sm">
            <Sparkles size={18} />
          </div>
          <span className="sidebar__title">Smart Booking</span>
        </div>

        <nav className="sidebar__nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? "nav-item--active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button className="nav-item" onClick={logout}>
            <LogOut size={20} />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar__left">
            <h1 className="topbar__title">{tabs.find((t) => t.id === tab)?.label}</h1>
            <span className="topbar__subtitle">Демо-студия косметологии</span>
          </div>
          <div className="topbar__right">
            <button className="btn btn--ghost btn--sm" onClick={refresh} disabled={loading}>
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              Обновить
            </button>
          </div>
        </header>

        <div className="content">
          {tab === "today" && (
            <TodayView
              appointments={todayAppointments}
              dashboard={dashboard}
              services={services}
              specialists={specialists}
              logs={logs}
              refresh={refresh}
              notify={notify}
            />
          )}
          {tab === "appointments" && (
            <AppointmentsView
              appointments={appointments}
              services={services}
              specialists={specialists}
              search={search}
              setSearch={setSearch}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              serviceFilter={serviceFilter}
              setServiceFilter={setServiceFilter}
              specialistFilter={specialistFilter}
              setSpecialistFilter={setSpecialistFilter}
              refresh={refresh}
              notify={notify}
            />
          )}
          {tab === "clients" && <ClientsView clients={clients} />}
          {tab === "services" && <ServicesView services={services} refresh={refresh} notify={notify} />}
          {tab === "specialists" && (
            <SpecialistsView specialists={specialists} services={services} refresh={refresh} notify={notify} />
          )}
          {tab === "settings" && <SettingsView settings={settings} refresh={refresh} notify={notify} />}
          {tab === "logs" && <LogsView logs={logs} />}
        </div>
      </main>

      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}

/* ── Today / Dashboard ────────────────────────── */

function TodayView({
  appointments,
  dashboard,
  services,
  specialists,
  logs,
  refresh,
  notify
}: {
  appointments: Appointment[];
  dashboard: { appointmentsToday: number; servicesActive: number; specialistsActive: number };
  services: ServiceItem[];
  specialists: Specialist[];
  logs: LogEntry[];
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const setStatus = async (id: string, status: string) => {
    await api.setAppointmentStatus(id, status);
    notify("Статус обновлён");
    await refresh();
  };

  const cancel = async (id: string) => {
    await api.cancelAppointment(id);
    notify("Запись отменена");
    await refresh();
  };

  const kpis = [
    {
      label: "Записей сегодня",
      value: appointments.length,
      icon: <CalendarDays size={20} />,
      color: "kpi--indigo"
    },
    {
      label: "Активных услуг",
      value: dashboard.servicesActive,
      icon: <Stethoscope size={20} />,
      color: "kpi--emerald"
    },
    {
      label: "Специалистов",
      value: dashboard.specialistsActive,
      icon: <UserRound size={20} />,
      color: "kpi--amber"
    },
    {
      label: "Всего клиентов",
      value: "—",
      icon: <UsersRound size={20} />,
      color: "kpi--violet"
    }
  ];

  return (
    <div className="dashboard">
      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`kpi ${kpi.color}`}>
            <div className="kpi__icon">{kpi.icon}</div>
            <div className="kpi__body">
              <span className="kpi__value">{kpi.value}</span>
              <span className="kpi__label">{kpi.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard__grid">
        <section className="card">
          <div className="card__header">
            <h2>
              <CalendarDays size={18} />
              Записи на сегодня
            </h2>
            <span className="card__badge">{appointments.length}</span>
          </div>
          <div className="card__body">
            {appointments.length > 0 ? (
              <div className="timeline">
                {appointments
                  .sort((a, b) => a.startAt.localeCompare(b.startAt))
                  .map((apt) => (
                    <div key={apt.id} className="timeline-item">
                      <div className="timeline-item__time">
                        <span className="timeline-item__clock">{formatTime(apt.startAt)}</span>
                        <span className="timeline-item__duration">{apt.service.durationMinutes} мин</span>
                      </div>
                      <div className="timeline-item__line" />
                      <div className="timeline-item__content">
                        <div className="timeline-item__top">
                          <strong>{apt.clientNameSnapshot}</strong>
                          <StatusBadge status={apt.status} />
                        </div>
                        <p className="timeline-item__service">{apt.service.name}</p>
                        <span className="timeline-item__specialist">{apt.specialist.name}</span>
                        {apt.clientPhoneSnapshot && (
                          <span className="timeline-item__phone">{apt.clientPhoneSnapshot}</span>
                        )}
                        <div className="timeline-item__actions">
                          <button className="btn btn--success btn--xs" onClick={() => setStatus(apt.id, "completed")}>
                            <Check size={13} /> Пришёл
                          </button>
                          <button className="btn btn--warn btn--xs" onClick={() => setStatus(apt.id, "no_show")}>
                            Не пришёл
                          </button>
                          <button className="btn btn--danger btn--xs" onClick={() => cancel(apt.id)}>
                            Отменить
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="empty-state">
                <CalendarDays size={32} />
                <p>На сегодня записей нет</p>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <h2>
              <Activity size={18} />
              Последние действия
            </h2>
          </div>
          <div className="card__body">
            <div className="activity-list">
              {logs.slice(0, 12).map((log) => (
                <div key={log.id} className={`activity-item activity-item--${log.level}`}>
                  <div className="activity-item__dot" />
                  <div className="activity-item__body">
                    <span className="activity-item__title">
                      {log.source} · {log.action}
                    </span>
                    <p className="activity-item__desc">{log.description}</p>
                    <span className="activity-item__time">{formatDateTime(log.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Appointments ─────────────────────────────── */

function AppointmentsView({
  appointments,
  services,
  specialists,
  search,
  setSearch,
  dateFilter,
  setDateFilter,
  statusFilter,
  setStatusFilter,
  serviceFilter,
  setServiceFilter,
  specialistFilter,
  setSpecialistFilter,
  refresh,
  notify
}: {
  appointments: Appointment[];
  services: ServiceItem[];
  specialists: Specialist[];
  search: string;
  setSearch: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  serviceFilter: string;
  setServiceFilter: (v: string) => void;
  specialistFilter: string;
  setSpecialistFilter: (v: string) => void;
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);

  const setStatus = async (id: string, status: string) => {
    await api.setAppointmentStatus(id, status);
    notify("Статус обновлён");
    await refresh();
  };

  const cancel = async (id: string) => {
    await api.cancelAppointment(id);
    notify("Запись отменена");
    await refresh();
  };

  return (
    <div className="page-appointments">
      <div className="card">
        <div className="card__header card__header--wrap">
          <div className="filter-bar">
            <div className="form-field form-field--sm">
              <label>Дата</label>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
            <div className="form-field form-field--sm">
              <label>Статус</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Все</option>
                {Object.entries(statusLabels).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--sm">
              <label>Услуга</label>
              <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                <option value="">Все</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--sm">
              <label>Специалист</label>
              <select value={specialistFilter} onChange={(e) => setSpecialistFilter(e.target.value)}>
                <option value="">Все</option>
                {specialists.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--sm form-field--search">
              <label>Поиск</label>
              <div className="input-with-icon">
                <Search size={15} />
                <input
                  placeholder="Имя или телефон"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && refresh()}
                />
              </div>
            </div>
          </div>
          <button className="btn btn--primary btn--sm" onClick={() => setShowCreate(true)}>
            <Plus size={15} />
            Новая запись
          </button>
        </div>

        <div className="card__body card__body--flush">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "130px" }}>Время</th>
                  <th>Клиент</th>
                  <th>Услуга</th>
                  <th>Специалист</th>
                  <th style={{ width: "130px" }}>Статус</th>
                  <th style={{ width: "220px" }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.id}>
                    <td>
                      <div className="cell-time">
                        <strong>{formatTime(apt.startAt)}</strong>
                        <span>{formatDateTime(apt.startAt).split(" ")[0]}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-client">
                        <strong>{apt.clientNameSnapshot}</strong>
                        {apt.clientPhoneSnapshot && <span>{apt.clientPhoneSnapshot}</span>}
                      </div>
                    </td>
                    <td>{apt.service.name}</td>
                    <td>{apt.specialist.name}</td>
                    <td>
                      <StatusBadge status={apt.status} />
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn btn--success btn--xs" onClick={() => setStatus(apt.id, "completed")}>
                          Пришёл
                        </button>
                        <button className="btn btn--warn btn--xs" onClick={() => setStatus(apt.id, "no_show")}>
                          Не пришёл
                        </button>
                        <button className="btn btn--danger btn--xs" onClick={() => cancel(apt.id)}>
                          Отменить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {appointments.length === 0 && (
              <div className="empty-state">
                <ClipboardList size={32} />
                <p>Записей не найдено</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateAppointmentModal
          services={services}
          specialists={specialists}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            notify("Запись создана");
            await refresh();
          }}
          notify={notify}
        />
      )}
    </div>
  );
}

function CreateAppointmentModal({
  services,
  specialists,
  onClose,
  onCreated,
  notify
}: {
  services: ServiceItem[];
  specialists: Specialist[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    serviceId: "",
    specialistId: "",
    date: todayInput(),
    time: "12:00",
    comment: ""
  });
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const specialistsForService = form.serviceId
    ? specialists.filter((s) => s.services?.some((item) => item.service.id === form.serviceId))
    : specialists;

  const loadSlots = async () => {
    if (!form.serviceId) {
      notify("Сначала выберите услугу");
      return;
    }
    setSlotsLoading(true);
    try {
      const items = await api.slots({
        serviceId: form.serviceId,
        date: form.date,
        specialistId: form.specialistId || undefined,
        limit: 12
      });
      setSlots(items);
      notify(items.length > 0 ? `Найдено ${items.length} свободных окон` : "Свободных окон нет");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSlotsLoading(false);
    }
  };

  const selectSlot = (slot: SlotOption) => {
    setForm({ ...form, specialistId: slot.specialistId, time: formatTime(slot.startAt) });
    notify(`Выбрано: ${formatTime(slot.startAt)}, ${slot.specialistName}`);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.createAppointment({ ...form, source: "manual" });
      await onCreated();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Не удалось создать запись");
    }
  };

  return (
    <Modal title="Новая запись" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <div className="form-field">
            <label>Имя клиента</label>
            <input
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              placeholder="Имя"
              required
            />
          </div>
          <div className="form-field">
            <label>Телефон</label>
            <input
              value={form.clientPhone}
              onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
              placeholder="+7..."
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Услуга</label>
            <select
              value={form.serviceId}
              onChange={(e) => {
                setForm({ ...form, serviceId: e.target.value, specialistId: "" });
                setSlots([]);
              }}
              required
            >
              <option value="">Выберите услугу</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.price} ₽</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Специалист</label>
            <select
              value={form.specialistId}
              onChange={(e) => {
                setForm({ ...form, specialistId: e.target.value });
                setSlots([]);
              }}
            >
              <option value="">Любой</option>
              {specialistsForService.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Дата</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => {
                setForm({ ...form, date: e.target.value });
                setSlots([]);
              }}
            />
          </div>
          <div className="form-field">
            <label>Время</label>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
        </div>
        <button type="button" className="btn btn--outline btn--full" onClick={loadSlots} disabled={slotsLoading}>
          <Clock size={15} />
          {slotsLoading ? "Поиск..." : "Найти свободные окна"}
        </button>
        {slots.length > 0 && (
          <div className="slot-grid">
            {slots.map((slot) => (
              <button
                type="button"
                key={`${slot.specialistId}-${slot.startAt}`}
                className="slot-btn"
                onClick={() => selectSlot(slot)}
              >
                <strong>{formatTime(slot.startAt)}</strong>
                <span>{slot.specialistName}</span>
              </button>
            ))}
          </div>
        )}
        <div className="form-field">
          <label>Комментарий</label>
          <textarea
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder="Комментарий..."
            rows={2}
          />
        </div>
        <button type="submit" className="btn btn--primary btn--full">
          <Save size={15} />
          Создать запись
        </button>
      </form>
    </Modal>
  );
}

/* ── Clients ──────────────────────────────────── */

function ClientsView({ clients }: { clients: Client[] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone ?? "").includes(search)
      ),
    [clients, search]
  );

  return (
    <div className="page-clients">
      <div className="card">
        <div className="card__header">
          <h2>
            <UsersRound size={18} />
            Клиенты
          </h2>
          <div className="input-with-icon input-with-icon--sm" style={{ width: 260 }}>
            <Search size={15} />
            <input
              placeholder="Поиск по имени или телефону"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="card__body">
          <div className="client-grid">
            {filtered.map((client) => (
              <div key={client.id} className="client-card">
                <div className="client-card__avatar">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="client-card__info">
                  <strong>{client.name}</strong>
                  <span>{client.phone ?? "Телефон не указан"}</span>
                  <div className="client-card__meta">
                    <span>{client.appointmentCount} записей</span>
                    {client.telegramId && <span>TG: {client.telegramId}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="empty-state">
              <UsersRound size={32} />
              <p>Клиентов не найдено</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Services ─────────────────────────────────── */

function ServicesView({
  services,
  refresh,
  notify
}: {
  services: ServiceItem[];
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    durationMinutes: 30,
    price: 0,
    description: "",
    bufferBefore: 0,
    bufferAfter: 0
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api.createService({ ...form, isActive: true });
    notify("Услуга добавлена");
    setShowCreate(false);
    await refresh();
  };

  const toggle = async (service: ServiceItem) => {
    await api.updateService(service.id, { isActive: !service.isActive });
    await refresh();
  };

  return (
    <div className="page-services">
      <div className="card">
        <div className="card__header">
          <h2>
            <Stethoscope size={18} />
            Услуги
          </h2>
          <button className="btn btn--primary btn--sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus size={15} />
            Добавить
          </button>
        </div>
        <div className="card__body">
          {showCreate && (
            <form className="form form--inline-card" onSubmit={submit}>
              <div className="form-row">
                <div className="form-field">
                  <label>Название</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-field form-field--sm">
                  <label>Минуты</label>
                  <input
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  />
                </div>
                <div className="form-field form-field--sm">
                  <label>Цена, ₽</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="form-field">
                <label>Описание</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>
              <button type="submit" className="btn btn--primary btn--sm">
                <Save size={14} /> Добавить
              </button>
            </form>
          )}
          <div className="service-grid">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} onToggle={toggle} refresh={refresh} notify={notify} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  onToggle,
  refresh,
  notify
}: {
  service: ServiceItem;
  onToggle: (s: ServiceItem) => Promise<void>;
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: service.name,
    durationMinutes: service.durationMinutes,
    price: service.price,
    description: service.description
  });

  useEffect(() => {
    setDraft({
      name: service.name,
      durationMinutes: service.durationMinutes,
      price: service.price,
      description: service.description
    });
  }, [service]);

  const save = async () => {
    await api.updateService(service.id, draft);
    notify("Сохранено");
    setEditing(false);
    await refresh();
  };

  return (
    <div className={`service-card ${!service.isActive ? "service-card--inactive" : ""}`}>
      <div className="service-card__header">
        {editing ? (
          <input
            className="service-card__name-input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        ) : (
          <h3 className="service-card__name">{service.name}</h3>
        )}
        <button
          className={`toggle ${service.isActive ? "toggle--on" : ""}`}
          onClick={() => onToggle(service)}
          title={service.isActive ? "Выключить" : "Включить"}
        >
          <span className="toggle__knob" />
        </button>
      </div>
      {editing ? (
        <div className="service-card__edit">
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={2}
          />
          <div className="form-row">
            <div className="form-field form-field--xs">
              <label>Мин</label>
              <input
                type="number"
                value={draft.durationMinutes}
                onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })}
              />
            </div>
            <div className="form-field form-field--xs">
              <label>Цена</label>
              <input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="service-card__edit-actions">
            <button className="btn btn--primary btn--xs" onClick={save}>
              <Save size={13} /> Сохранить
            </button>
            <button className="btn btn--ghost btn--xs" onClick={() => setEditing(false)}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="service-card__details" onClick={() => setEditing(true)}>
          <p className="service-card__desc">{service.description}</p>
          <div className="service-card__meta">
            <span className="service-card__duration">
              <Clock size={13} /> {service.durationMinutes} мин
            </span>
            <span className="service-card__price">{service.price.toLocaleString("ru-RU")} ₽</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Specialists ──────────────────────────────── */

function SpecialistsView({
  specialists,
  services,
  refresh,
  notify
}: {
  specialists: Specialist[];
  services: ServiceItem[];
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newSpec, setNewSpec] = useState({ name: "", position: "", adminComment: "" });
  const [block, setBlock] = useState({ specialistId: "", date: todayInput(), startTime: "15:00", endTime: "16:00", reason: "" });
  const [workingHour, setWorkingHour] = useState({ specialistId: "", dayOfWeek: 1, startTime: "10:00", endTime: "19:00" });
  const [breakTime, setBreakTime] = useState({ specialistId: "", dayOfWeek: 1, startTime: "14:00", endTime: "15:00", reason: "перерыв" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const submitSpecialist = async (event: FormEvent) => {
    event.preventDefault();
    await api.createSpecialist({ ...newSpec, isActive: true });
    setNewSpec({ name: "", position: "", adminComment: "" });
    setShowCreate(false);
    notify("Специалист добавлен");
    await refresh();
  };

  const toggleSpecialist = async (s: Specialist) => {
    await api.updateSpecialist(s.id, { isActive: !s.isActive });
    await refresh();
  };

  const toggleService = async (s: Specialist, svc: ServiceItem) => {
    const assigned = s.services?.some((item) => item.service.id === svc.id);
    if (assigned) {
      await api.unassignSpecialistService(s.id, svc.id);
    } else {
      await api.assignSpecialistService(s.id, svc.id);
    }
    await refresh();
  };

  const submitWorkingHour = async (event: FormEvent) => {
    event.preventDefault();
    await api.addWorkingHour(workingHour.specialistId, {
      dayOfWeek: workingHour.dayOfWeek,
      startTime: workingHour.startTime,
      endTime: workingHour.endTime
    });
    notify("Рабочие часы добавлены");
    await refresh();
  };

  const submitBreak = async (event: FormEvent) => {
    event.preventDefault();
    await api.addBreak(breakTime.specialistId, {
      dayOfWeek: breakTime.dayOfWeek,
      startTime: breakTime.startTime,
      endTime: breakTime.endTime,
      reason: breakTime.reason
    });
    notify("Перерыв добавлен");
    await refresh();
  };

  const submitBlock = async (event: FormEvent) => {
    event.preventDefault();
    await api.createTimeBlock(block);
    notify("Время заблокировано");
    await refresh();
  };

  return (
    <div className="page-specialists">
      <div className="card">
        <div className="card__header">
          <h2>
            <UserRound size={18} />
            Специалисты
          </h2>
          <button className="btn btn--primary btn--sm" onClick={() => setShowCreate(!showCreate)}>
            <Plus size={15} />
            Добавить
          </button>
        </div>
        <div className="card__body">
          {showCreate && (
            <form className="form form--inline-card" onSubmit={submitSpecialist}>
              <div className="form-row">
                <div className="form-field">
                  <label>Имя</label>
                  <input value={newSpec.name} onChange={(e) => setNewSpec({ ...newSpec, name: e.target.value })} required />
                </div>
                <div className="form-field">
                  <label>Должность</label>
                  <input value={newSpec.position} onChange={(e) => setNewSpec({ ...newSpec, position: e.target.value })} required />
                </div>
              </div>
              <button type="submit" className="btn btn--primary btn--sm">
                <Save size={14} /> Добавить
              </button>
            </form>
          )}

          <div className="specialist-list">
            {specialists.map((spec) => (
              <div key={spec.id} className={`specialist-card ${!spec.isActive ? "specialist-card--inactive" : ""}`}>
                <div className="specialist-card__header" onClick={() => setExpandedId(expandedId === spec.id ? null : spec.id)}>
                  <div className="specialist-card__avatar">
                    {spec.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="specialist-card__info">
                    <strong>{spec.name}</strong>
                    <span>{spec.position}</span>
                    <div className="specialist-card__tags">
                      {spec.services?.map((s) => (
                        <span key={s.service.id} className="tag">{s.service.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="specialist-card__controls">
                    <button
                      className={`toggle ${spec.isActive ? "toggle--on" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSpecialist(spec);
                      }}
                    >
                      <span className="toggle__knob" />
                    </button>
                    <ChevronDown
                      size={18}
                      className={`chevron ${expandedId === spec.id ? "chevron--open" : ""}`}
                    />
                  </div>
                </div>

                {expandedId === spec.id && (
                  <div className="specialist-card__expand">
                    <div className="specialist-card__section">
                      <h4>Услуги</h4>
                      <div className="tag-toggle-grid">
                        {services.map((svc) => {
                          const assigned = spec.services?.some((item) => item.service.id === svc.id);
                          return (
                            <button
                              key={svc.id}
                              className={`tag-toggle ${assigned ? "tag-toggle--on" : ""}`}
                              onClick={() => toggleService(spec, svc)}
                            >
                              {svc.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {spec.workingHours && spec.workingHours.length > 0 && (
                      <div className="specialist-card__section">
                        <h4>Рабочие часы</h4>
                        <div className="schedule-grid">
                          {spec.workingHours.map((wh) => (
                            <span key={wh.id} className="schedule-chip">
                              {dayLabels[wh.dayOfWeek]} {wh.startTime}–{wh.endTime}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {spec.breaks && spec.breaks.length > 0 && (
                      <div className="specialist-card__section">
                        <h4>Перерывы</h4>
                        <div className="schedule-grid">
                          {spec.breaks.map((br) => (
                            <span key={br.id} className="schedule-chip schedule-chip--warn">
                              {dayLabels[br.dayOfWeek]} {br.startTime}–{br.endTime}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {spec.timeBlocks && spec.timeBlocks.length > 0 && (
                      <div className="specialist-card__section">
                        <h4>Блокировки</h4>
                        <div className="schedule-grid">
                          {spec.timeBlocks.map((tb) => (
                            <span key={tb.id} className="schedule-chip schedule-chip--danger">
                              {tb.date} {tb.startTime}–{tb.endTime} · {tb.reason}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <h2>
            <Clock size={18} />
            Расписание
          </h2>
        </div>
        <div className="card__body">
          <div className="schedule-forms">
            <div className="schedule-form">
              <h3>Рабочие часы</h3>
              <form className="form" onSubmit={submitWorkingHour}>
                <select value={workingHour.specialistId} onChange={(e) => setWorkingHour({ ...workingHour, specialistId: e.target.value })} required>
                  <option value="">Специалист</option>
                  {specialists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="form-row">
                  <select value={workingHour.dayOfWeek} onChange={(e) => setWorkingHour({ ...workingHour, dayOfWeek: Number(e.target.value) })}>
                    {dayLabels.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                  <input type="time" value={workingHour.startTime} onChange={(e) => setWorkingHour({ ...workingHour, startTime: e.target.value })} />
                  <input type="time" value={workingHour.endTime} onChange={(e) => setWorkingHour({ ...workingHour, endTime: e.target.value })} />
                </div>
                <button type="submit" className="btn btn--outline btn--sm btn--full">Добавить</button>
              </form>
            </div>

            <div className="schedule-form">
              <h3>Перерыв</h3>
              <form className="form" onSubmit={submitBreak}>
                <select value={breakTime.specialistId} onChange={(e) => setBreakTime({ ...breakTime, specialistId: e.target.value })} required>
                  <option value="">Специалист</option>
                  {specialists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="form-row">
                  <select value={breakTime.dayOfWeek} onChange={(e) => setBreakTime({ ...breakTime, dayOfWeek: Number(e.target.value) })}>
                    {dayLabels.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                  <input type="time" value={breakTime.startTime} onChange={(e) => setBreakTime({ ...breakTime, startTime: e.target.value })} />
                  <input type="time" value={breakTime.endTime} onChange={(e) => setBreakTime({ ...breakTime, endTime: e.target.value })} />
                </div>
                <button type="submit" className="btn btn--outline btn--sm btn--full">Добавить</button>
              </form>
            </div>

            <div className="schedule-form">
              <h3>Блокировка времени</h3>
              <form className="form" onSubmit={submitBlock}>
                <select value={block.specialistId} onChange={(e) => setBlock({ ...block, specialistId: e.target.value })} required>
                  <option value="">Специалист</option>
                  {specialists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="form-row">
                  <input type="date" value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} />
                  <input type="time" value={block.startTime} onChange={(e) => setBlock({ ...block, startTime: e.target.value })} />
                  <input type="time" value={block.endTime} onChange={(e) => setBlock({ ...block, endTime: e.target.value })} />
                </div>
                <input placeholder="Причина" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
                <button type="submit" className="btn btn--outline btn--sm btn--full">Заблокировать</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Settings ─────────────────────────────────── */

function SettingsView({
  settings,
  refresh,
  notify
}: {
  settings: Setting[];
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
}) {
  const testReminder = async () => {
    const result = await api.sendTestReminder();
    notify(result.message);
  };

  return (
    <div className="page-settings">
      <div className="card">
        <div className="card__header">
          <h2>
            <Settings size={18} />
            Настройки
          </h2>
          <button className="btn btn--outline btn--sm" onClick={testReminder}>
            <Bell size={15} />
            Тестовое напоминание
          </button>
        </div>
        <div className="card__body">
          <div className="settings-list">
            {settings.map((s) => (
              <SettingRow key={s.id} setting={s} onSave={async () => { notify("Сохранено"); await refresh(); }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ setting, onSave }: { setting: Setting; onSave: () => Promise<void> }) {
  const [value, setValue] = useState(setting.value);
  useEffect(() => setValue(setting.value), [setting.value]);

  const save = async () => {
    await api.updateSetting({ key: setting.key, value });
    await onSave();
  };

  return (
    <div className="setting-row">
      <div className="setting-row__label">
        <strong>{setting.description ?? setting.key}</strong>
        <code>{setting.key}</code>
      </div>
      <div className="setting-row__input">
        <input value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn btn--ghost btn--xs" onClick={save}>
          <Save size={13} />
        </button>
      </div>
    </div>
  );
}

/* ── Logs ─────────────────────────────────────── */

function LogsView({ logs }: { logs: LogEntry[] }) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(
    () => logs.filter((l) => !filter || l.level === filter),
    [logs, filter]
  );

  return (
    <div className="page-logs">
      <div className="card">
        <div className="card__header">
          <h2>
            <Logs size={18} />
            Логи
          </h2>
          <div className="log-filters">
            {["", "info", "warning", "error"].map((level) => (
              <button
                key={level}
                className={`btn btn--xs ${filter === level ? "btn--primary" : "btn--ghost"}`}
                onClick={() => setFilter(level)}
              >
                {level || "Все"}
              </button>
            ))}
          </div>
        </div>
        <div className="card__body">
          <div className="log-list">
            {filtered.map((log) => (
              <div key={log.id} className={`log-entry log-entry--${log.level}`}>
                <div className="log-entry__bar" />
                <div className="log-entry__body">
                  <div className="log-entry__header">
                    <span className="log-entry__source">{log.source} · {log.action}</span>
                    <span className="log-entry__time">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <p className="log-entry__desc">{log.description}</p>
                </div>
              </div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="empty-state">
              <Logs size={32} />
              <p>Логов нет</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
