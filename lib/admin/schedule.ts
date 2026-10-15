import { addDays, startOfWeekMonday, zonedLocalDateTimeToUtc } from "../availability.ts";
import type { AdminLightingMode, AdminReservationStatus } from "./reservations.ts";
import type { AdminBlockReason } from "./operations.ts";

export type AdminBlockStatus = "active" | "cancelled";
export type AdminScheduleStatus =
  | "available"
  | "pending"
  | "confirmed"
  | "completed"
  | "blocked"
  | "unavailable";

export type AdminReservationScheduleEntry = {
  entryKind: "reservation";
  id: string;
  status: AdminReservationStatus;
  startAt: string;
  endAt: string;
  customerName: string | null;
  customerPhoneE164: string | null;
  lighting: AdminLightingMode;
  netHeightCm: number | null;
  hourlyRate: number;
  totalAmount: number;
  currency: string;
  source: "public_web" | "admin" | "phone" | "whatsapp" | "other";
  blockReason: null;
  internalNote: null;
};

export type AdminBlockScheduleEntry = {
  entryKind: "block";
  id: string;
  status: AdminBlockStatus;
  startAt: string;
  endAt: string;
  customerName: null;
  customerPhoneE164: null;
  lighting: null;
  netHeightCm: null;
  hourlyRate: null;
  totalAmount: null;
  currency: string;
  source: null;
  blockReason: AdminBlockReason;
  internalNote: string | null;
};

export type AdminScheduleEntry = AdminReservationScheduleEntry | AdminBlockScheduleEntry;

export type AdminScheduleDay = {
  businessId: string;
  bookingIncrementMinutes: number;
  courtId: string;
  courtName: string;
  date: string;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  scheduleStatus: "provisional" | "confirmed";
  entries: AdminScheduleEntry[];
};

export type AdminScheduleSnapshot = {
  from: string;
  to: string;
  timezone: string;
  bookingIncrementMinutes: number;
  courts: Array<{
    courtId: string;
    courtName: string;
    days: AdminScheduleDay[];
  }>;
};

export type AdminBoardSlot = {
  id: string;
  date: string;
  start: string;
  end: string;
  status: AdminScheduleStatus;
  entry: AdminScheduleEntry | null;
  releasedEntries: AdminScheduleEntry[];
};

function toMinutes(time: string) {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function toTime(total: number) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function intersects(slotStart: Date, slotEnd: Date, entry: AdminScheduleEntry) {
  const start = new Date(entry.startAt);
  const end = new Date(entry.endAt);
  return start < slotEnd && end > slotStart;
}

function entryPriority(entry: AdminScheduleEntry) {
  if (entry.entryKind === "block" && entry.status === "active") return 50;
  if (entry.entryKind === "reservation" && entry.status === "pending") return 40;
  if (entry.entryKind === "reservation" && entry.status === "confirmed") return 30;
  if (entry.entryKind === "reservation" && entry.status === "completed") return 20;
  return 0;
}

export function adminEntryBlocksAvailability(entry: AdminScheduleEntry) {
  if (entry.entryKind === "block") return entry.status === "active";
  return entry.status === "pending" || entry.status === "confirmed" || entry.status === "completed";
}

export function adminEntryStatus(entry: AdminScheduleEntry): AdminScheduleStatus {
  if (entry.entryKind === "block") return entry.status === "active" ? "blocked" : "available";
  if (entry.status === "pending") return "pending";
  if (entry.status === "confirmed") return "confirmed";
  if (entry.status === "completed") return "completed";
  return "available";
}

export function buildAdminBoardSlots(
  day: AdminScheduleDay,
  timezone: string,
  now = new Date(),
): AdminBoardSlot[] {
  if (!day.isOpen || !day.opensAt || !day.closesAt) return [];

  const startMinutes = toMinutes(day.opensAt);
  const endMinutes = toMinutes(day.closesAt);
  const step = Math.max(15, day.bookingIncrementMinutes || 60);
  const slots: AdminBoardSlot[] = [];

  for (let cursor = startMinutes; cursor + step <= endMinutes; cursor += step) {
    const start = toTime(cursor);
    const end = toTime(cursor + step);
    const startUtc = zonedLocalDateTimeToUtc(day.date, start, timezone);
    const endUtc = zonedLocalDateTimeToUtc(day.date, end, timezone);
    const intersecting = day.entries.filter((entry) => intersects(startUtc, endUtc, entry));
    const blocking = intersecting
      .filter(adminEntryBlocksAvailability)
      .sort((a, b) => entryPriority(b) - entryPriority(a))[0] ?? null;
    const releasedEntries = intersecting.filter((entry) => !adminEntryBlocksAvailability(entry));

    let status: AdminScheduleStatus = blocking ? adminEntryStatus(blocking) : "available";
    if (!blocking && startUtc <= now) status = "unavailable";

    slots.push({
      id: `${day.courtId}-${day.date}-${start}`,
      date: day.date,
      start,
      end,
      status,
      entry: blocking,
      releasedEntries,
    });
  }

  return slots;
}

export function adminScheduleStatusLabel(status: AdminScheduleStatus) {
  const labels: Record<AdminScheduleStatus, string> = {
    available: "Disponible",
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    blocked: "Bloqueada",
    unavailable: "No disponible",
  };
  return labels[status];
}

export function getAdminWeekRange(referenceDate: string) {
  const from = startOfWeekMonday(referenceDate);
  return { from, to: addDays(from, 6) };
}

export function getLocalDateTimeParts(iso: string, timezone = "America/Lima") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}
