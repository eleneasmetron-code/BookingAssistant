import { addMinutes, format, isBefore, parseISO, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const toLocalDateKey = (date: Date, timezone: string): string =>
  formatInTimeZone(date, timezone, "yyyy-MM-dd");

export const toLocalTime = (date: Date, timezone: string): string =>
  formatInTimeZone(date, timezone, "HH:mm");

export const toHumanDateTime = (date: Date, timezone: string): string =>
  formatInTimeZone(date, timezone, "dd.MM.yyyy HH:mm");

export const toHumanDate = (date: Date, timezone: string): string =>
  formatInTimeZone(date, timezone, "dd.MM.yyyy");

export const toHumanTime = (date: Date, timezone: string): string =>
  formatInTimeZone(date, timezone, "HH:mm");

export const localDateTimeToUtc = (dateKey: string, time: string, timezone: string): Date =>
  fromZonedTime(`${dateKey}T${time}:00`, timezone);

export const localDateRangeToUtc = (dateKey: string, timezone: string): { from: Date; to: Date } => ({
  from: localDateTimeToUtc(dateKey, "00:00", timezone),
  to: localDateTimeToUtc(dateKey, "23:59", timezone)
});

export const getLocalDayOfWeek = (dateKey: string, timezone: string): number => {
  const utc = localDateTimeToUtc(dateKey, "12:00", timezone);
  return toZonedTime(utc, timezone).getDay();
};

export const minutesFromTime = (time: string): number => {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw ?? 0);
  const minutes = Number(minutesRaw ?? 0);
  return hours * 60 + minutes;
};

export const timeFromMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

export const addMinutesToDate = (date: Date, minutes: number): Date => addMinutes(date, minutes);

export const isPast = (date: Date): boolean => isBefore(date, new Date());

export const todayKey = (timezone: string): string => {
  const local = toZonedTime(new Date(), timezone);
  return format(startOfDay(local), "yyyy-MM-dd");
};

export const dateKeyFromText = (text: string, timezone: string): string | undefined => {
  const normalized = text.toLowerCase();
  const nowLocal = toZonedTime(new Date(), timezone);
  const start = startOfDay(nowLocal);

  if (normalized.includes("сегодня")) {
    return format(start, "yyyy-MM-dd");
  }

  if (normalized.includes("завтра")) {
    const tomorrow = addMinutes(start, 24 * 60);
    return format(tomorrow, "yyyy-MM-dd");
  }

  const iso = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso?.[1]) {
    return format(parseISO(iso[1]), "yyyy-MM-dd");
  }

  const dotted = normalized.match(/\b(\d{1,2})[.](\d{1,2})(?:[.](\d{4}))?\b/);
  if (dotted?.[1] && dotted[2]) {
    const year = dotted[3] ?? String(nowLocal.getFullYear());
    return `${year}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
  }

  return undefined;
};

export const periodToStartMinute = (text?: string): number | undefined => {
  if (!text) {
    return undefined;
  }

  const normalized = text.toLowerCase();
  const after = normalized.match(/после\s*(\d{1,2})/);
  if (after?.[1]) {
    return Number(after[1]) * 60;
  }

  if (normalized.includes("вечер")) {
    return 18 * 60;
  }

  if (normalized.includes("после работы")) {
    return 18 * 60;
  }

  if (normalized.includes("до обед")) {
    return 10 * 60;
  }

  if (normalized.includes("утр")) {
    return 10 * 60;
  }

  return undefined;
};
