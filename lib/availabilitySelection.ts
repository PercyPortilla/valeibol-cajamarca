import type { AvailabilitySlot } from "./availability.ts";

/** Solo propone franjas consecutivas realmente disponibles del MISMO campo y día. */
export function consecutiveAvailableEnd(slots: AvailabilitySlot[], start: string, durationMinutes: number): string | null {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 240) return null;
  let cursor = start;
  let elapsed = 0;
  const date = slots.find((slot) => slot.start === start)?.date;
  if (!date) return null;
  while (elapsed < durationMinutes) {
    const slot = slots.find((item) => item.date === date && item.start === cursor);
    if (!slot || slot.status !== "available") return null;
    const [sh, sm] = slot.start.split(":").map(Number);
    const [eh, em] = slot.end.split(":").map(Number);
    const segment = eh * 60 + em - (sh * 60 + sm);
    if (segment <= 0 || elapsed + segment > durationMinutes) return null;
    elapsed += segment;
    cursor = slot.end;
  }
  return cursor;
}
