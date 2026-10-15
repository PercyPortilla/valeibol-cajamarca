import { businessConfig } from "../config/business.ts";
import { zonedLocalDateTimeToUtc, type AvailabilitySlot } from "./availability.ts";

export type LightingMode = "without_lights" | "with_lights";
export type NetHeightCm = number;

export const NET_HEIGHT_PRESETS = [
  { id: "women", cm: 224, label: "Damas · 2.24 m (FIVB)" },
  { id: "men", cm: 243, label: "Varones · 2.43 m (FIVB)" },
  { id: "mixed", cm: 243, label: "Mixto · 2.43 m (referencia USAV)" },
  { id: "reverse-mixed", cm: 224, label: "Mixto reverse · 2.24 m (referencia USAV)" },
] as const;

export type BookingEndOption = {
  end: string;
  durationMinutes: number;
  label: string;
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

const LIGHTING_CUTOFF_MINUTES = 18 * 60;

export function crossesLightingCutoff(start: string, end: string) {
  return timeToMinutes(start) < LIGHTING_CUTOFF_MINUTES && timeToMinutes(end) > LIGHTING_CUTOFF_MINUTES;
}

export function bookingLightingForInterval(start: string, end: string): LightingMode {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (endMinutes <= startMinutes) {
    throw new Error("El horario final debe ser posterior al horario inicial.");
  }
  if (crossesLightingCutoff(start, end)) {
    throw new Error("Las reservas no pueden cruzar las 18:00 porque cambia la tarifa de iluminación.");
  }
  return startMinutes >= LIGHTING_CUTOFF_MINUTES ? "with_lights" : "without_lights";
}

export function isNetHeightCm(value: unknown): value is NetHeightCm {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 180
    && value <= 250;
}

export function netHeightLabel(value: NetHeightCm | null | undefined) {
  return isNetHeightCm(value) ? `${value} cm` : "No registrada";
}

export function durationMinutes(start: string, end: string) {
  return timeToMinutes(end) - timeToMinutes(start);
}

export type BookingPreviewRates = { withoutLights: number; withLights: number };

export function previewHourlyRate(
  lighting: LightingMode,
  rates: BookingPreviewRates = businessConfig.pricing,
) {
  return lighting === "with_lights" ? rates.withLights : rates.withoutLights;
}

export function calculateBookingPreview(
  start: string,
  end: string,
  lighting: LightingMode,
  rates: BookingPreviewRates = businessConfig.pricing,
) {
  const minutes = durationMinutes(start, end);
  if (minutes <= 0) {
    throw new Error("El horario final debe ser posterior al horario inicial.");
  }

  const hourlyRate = previewHourlyRate(lighting, rates);
  return {
    durationMinutes: minutes,
    durationHours: minutes / 60,
    hourlyRate,
    total: Number(((hourlyRate * minutes) / 60).toFixed(2)),
  };
}

export function normalizePeruWhatsApp(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("+")) {
    const compact = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return /^\+[1-9][0-9]{7,14}$/.test(compact) ? compact : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (/^9\d{8}$/.test(digits)) return `+51${digits}`;
  if (/^519\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

export function normalizeCustomerName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidCustomerName(value: string) {
  const normalized = normalizeCustomerName(value);
  return normalized.length >= 2 && normalized.length <= 120;
}

export function isPastLocalStart(
  date: string,
  start: string,
  timezone: string = businessConfig.timezone,
  now = new Date(),
) {
  return zonedLocalDateTimeToUtc(date, start, timezone).getTime() <= now.getTime();
}

export function getContiguousEndOptions(
  slots: AvailabilitySlot[],
  startSlotId: string,
): BookingEndOption[] {
  const index = slots.findIndex((slot) => slot.id === startSlotId);
  if (index < 0 || slots[index].status !== "available") return [];

  const options: BookingEndOption[] = [];
  const start = slots[index].start;
  let expectedStart = start;

  for (let cursor = index; cursor < slots.length; cursor += 1) {
    const slot = slots[cursor];
    if (slot.status !== "available" || slot.start !== expectedStart) break;

    const minutes = durationMinutes(start, slot.end);
    options.push({
      end: slot.end,
      durationMinutes: minutes,
      label: `${slot.end} · ${minutes / 60} h`,
    });
    expectedStart = slot.end;
  }

  return options;
}

export function formatMoney(value: number, currency: string = businessConfig.currency) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}
