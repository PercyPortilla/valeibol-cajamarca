import { businessConfig } from "../config/business.ts";

export type SlotStatus = "available" | "occupied" | "unavailable";
export type BusyKind = "reservation" | "block";
export type ConfigurationStatus = "provisional" | "confirmed";

export type AvailabilitySlot = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: SlotStatus;
};

export type CalendarDay = {
  date: string;
  weekdayShort: string;
  weekdayLong: string;
  dayNumber: string;
  monthShort: string;
  isToday: boolean;
  slots: AvailabilitySlot[];
};

export type PublicBusyInterval = {
  startAt: string;
  endAt: string;
  kind: BusyKind;
};

export type PublicOperatingDay = {
  date: string;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  scheduleStatus: ConfigurationStatus;
  busyIntervals: PublicBusyInterval[];
};

export type CourtAvailabilityWeek = {
  courtId: string;
  courtName: string;
  timezone: string;
  days: CalendarDay[];
};

export type AvailabilityWeekSnapshot = {
  businessId: string | null;
  source: "supabase" | "mock-provisional";
  sourceLabel: string;
  isProvisional: boolean;
  courts: CourtAvailabilityWeek[];
};

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function dateKeyFromDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function businessTodayDateKey(now = new Date(), timezone: string = businessConfig.timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDays(dateKey: string, amount: number) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKeyFromDate(date);
}

export function startOfWeekMonday(dateKey: string) {
  const date = dateFromKey(dateKey);
  const day = date.getUTCDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, distanceToMonday);
}

export function getWeekDateKeys(referenceDateKey: string) {
  const monday = startOfWeekMonday(referenceDateKey);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function getDayKey(dateKey: string): DayKey {
  return DAY_KEYS[dateFromKey(dateKey).getUTCDay()];
}

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function deterministicStatus(dateKey: string, start: string): SlotStatus {
  // Fallback de demostración: no representa reservas reales y no contiene PII.
  const seed = `${dateKey}-${start}`
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  const value = seed % 10;

  if (value <= 5) return "available";
  if (value <= 8) return "occupied";
  return "unavailable";
}

export function generateMockSlotsForDate(dateKey: string): AvailabilitySlot[] {
  const dayConfig = businessConfig.availability.weeklySchedule[getDayKey(dateKey)];
  if (!dayConfig.enabled) return [];

  const start = toMinutes(dayConfig.opensAt);
  const end = toMinutes(dayConfig.closesAt);
  const step = businessConfig.availability.slotMinutes;
  const slots: AvailabilitySlot[] = [];

  for (let cursor = start; cursor + step <= end; cursor += step) {
    const startTime = toTime(cursor);
    const endTime = toTime(cursor + step);
    slots.push({
      id: `${dateKey}-${startTime}`,
      date: dateKey,
      start: startTime,
      end: endTime,
      status: deterministicStatus(dateKey, startTime),
    });
  }

  return slots;
}

function formatDate(dateKey: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-PE", {
    ...options,
    timeZone: "UTC",
  }).format(dateFromKey(dateKey));
}

function calendarDayShell(dateKey: string, todayDateKey: string, slots: AvailabilitySlot[]): CalendarDay {
  return {
    date: dateKey,
    weekdayShort: formatDate(dateKey, { weekday: "short" }).replace(".", ""),
    weekdayLong: formatDate(dateKey, { weekday: "long" }),
    dayNumber: formatDate(dateKey, { day: "2-digit" }),
    monthShort: formatDate(dateKey, { month: "short" }).replace(".", ""),
    isToday: dateKey === todayDateKey,
    slots,
  };
}

export function formatWeekRange(weekDateKeys: string[]) {
  const first = weekDateKeys[0];
  const last = weekDateKeys[weekDateKeys.length - 1];
  const firstDate = dateFromKey(first);
  const lastDate = dateFromKey(last);
  const sameMonth = firstDate.getUTCMonth() === lastDate.getUTCMonth();
  const sameYear = firstDate.getUTCFullYear() === lastDate.getUTCFullYear();

  if (sameMonth && sameYear) {
    return `${firstDate.getUTCDate()}–${lastDate.getUTCDate()} ${formatDate(last, { month: "short", year: "numeric" })}`;
  }

  if (sameYear) {
    return `${formatDate(first, { day: "numeric", month: "short" })} – ${formatDate(last, { day: "numeric", month: "short", year: "numeric" })}`;
  }

  return `${formatDate(first, { day: "numeric", month: "short", year: "numeric" })} – ${formatDate(last, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function buildCalendarDays(referenceDateKey: string, todayDateKey: string): CalendarDay[] {
  return getWeekDateKeys(referenceDateKey).map((dateKey) =>
    calendarDayShell(dateKey, todayDateKey, generateMockSlotsForDate(dateKey)),
  );
}

/**
 * Convierte una fecha/hora local de una zona IANA a UTC usando Intl.
 * Evita hardcodear -05:00 y mantiene la zona America/Lima como fuente de verdad.
 */
export function zonedLocalDateTimeToUtc(dateKey: string, time: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = desiredAsUtc;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedLocalAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      0,
      0,
    );
    guess += desiredAsUtc - representedLocalAsUtc;
  }

  return new Date(guess);
}

function statusForInterval(
  slotStart: Date,
  slotEnd: Date,
  busyIntervals: PublicBusyInterval[],
): SlotStatus {
  const overlap = busyIntervals.find((busy) => {
    const busyStart = new Date(busy.startAt);
    const busyEnd = new Date(busy.endAt);
    return slotStart < busyEnd && slotEnd > busyStart;
  });

  if (!overlap) return "available";
  return overlap.kind === "block" ? "unavailable" : "occupied";
}

export function buildSlotsFromOperatingDay(
  day: PublicOperatingDay,
  timeZone: string,
  slotMinutes: number = businessConfig.availability.slotMinutes,
): AvailabilitySlot[] {
  if (!day.isOpen || !day.opensAt || !day.closesAt) return [];

  const start = toMinutes(day.opensAt);
  const end = toMinutes(day.closesAt);
  const slots: AvailabilitySlot[] = [];

  for (let cursor = start; cursor + slotMinutes <= end; cursor += slotMinutes) {
    const startTime = toTime(cursor);
    const endTime = toTime(cursor + slotMinutes);
    const slotStart = zonedLocalDateTimeToUtc(day.date, startTime, timeZone);
    const slotEnd = zonedLocalDateTimeToUtc(day.date, endTime, timeZone);

    slots.push({
      id: `${day.date}-${startTime}`,
      date: day.date,
      start: startTime,
      end: endTime,
      status: statusForInterval(slotStart, slotEnd, day.busyIntervals),
    });
  }

  return slots;
}

export function buildCalendarDaysFromOperatingDays(
  operatingDays: PublicOperatingDay[],
  todayDateKey: string,
  timeZone: string,
  slotMinutes: number = businessConfig.availability.slotMinutes,
): CalendarDay[] {
  return operatingDays.map((day) =>
    calendarDayShell(day.date, todayDateKey, buildSlotsFromOperatingDay(day, timeZone, slotMinutes)),
  );
}

export function formatTimeRange(start: string, end: string) {
  return `${start}–${end}`;
}
