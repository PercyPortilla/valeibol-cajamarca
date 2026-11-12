import { buildAdminBoardSlots, getLocalDateTimeParts, type AdminScheduleSnapshot } from "./schedule.ts";

export type CourtWeekIndicator = {
  courtId: string;
  courtName: string;
  capacityHours: number;
  occupiedHours: number;
  reservedHours: number;
  occupancyPercent: number;
  pendingCount: number;
  confirmedCount: number;
  completedCount: number;
  activeBlocks: number;
  reservationValue: number;
  currency: string | null;
};

/**
 * Lectura pura de la agenda del negocio autorizado. No consulta otros tenants ni
 * considera el valor de una reserva como dinero cobrado.
 *
 * Las ocupaciones se computan sobre intervalos de la propia pizarra para no
 * duplicar reservas que atraviesan dos días ni superponer bloqueos.
 */
export function buildCourtWeekIndicators(snapshot: AdminScheduleSnapshot, now: Date): CourtWeekIndicator[] {
  return snapshot.courts.map((court) => {
    let capacitySlots = 0;
    let occupiedSlots = 0;
    let reservedSlots = 0;
    const entries = new Map<string, (typeof court.days)[number]["entries"][number]>();

    for (const day of court.days) {
      const slots = buildAdminBoardSlots(day, snapshot.timezone, now);
      capacitySlots += slots.length;
      occupiedSlots += slots.filter((slot) => ["pending", "confirmed", "completed", "blocked"].includes(slot.status)).length;
      reservedSlots += slots.filter((slot) => slot.status === "confirmed" || slot.status === "completed").length;
      for (const entry of day.entries) entries.set(`${entry.entryKind}:${entry.id}`, entry);
    }

    let pendingCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    let activeBlocks = 0;
    let reservationValue = 0;
    const currencies = new Set<string>();
    for (const entry of entries.values()) {
      if (entry.entryKind === "block") {
        if (entry.status === "active") activeBlocks++;
        continue;
      }
      // Solo las reservas que inician en la semana cuentan para valor y cantidad;
      // un mismo registro puede figurar en varios días de la agenda.
      const localStart = getLocalDateTimeParts(entry.startAt, snapshot.timezone).date;
      if (localStart < snapshot.from || localStart > snapshot.to) continue;
      if (entry.status === "pending") pendingCount++;
      if (entry.status === "confirmed") confirmedCount++;
      if (entry.status === "completed") completedCount++;
      if (entry.status === "confirmed" || entry.status === "completed") {
        reservationValue += entry.totalAmount;
        currencies.add(entry.currency);
      }
    }

    const step = snapshot.bookingIncrementMinutes / 60;
    return {
      courtId: court.courtId,
      courtName: court.courtName,
      capacityHours: capacitySlots * step,
      occupiedHours: occupiedSlots * step,
      reservedHours: reservedSlots * step,
      occupancyPercent: capacitySlots ? Math.round(occupiedSlots / capacitySlots * 1000) / 10 : 0,
      pendingCount, confirmedCount, completedCount, activeBlocks,
      reservationValue: currencies.size <= 1 ? reservationValue : 0,
      currency: currencies.size === 1 ? [...currencies][0] : currencies.size > 1 ? null : "PEN",
    };
  });
}
