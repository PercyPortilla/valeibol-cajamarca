import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { addDays } from "../lib/availability.ts";
import { buildCourtWeekIndicators } from "../lib/admin/weeklyCommand.ts";
import type { AdminScheduleDay, AdminScheduleSnapshot } from "../lib/admin/schedule.ts";

function weekFixture(): AdminScheduleSnapshot {
  const from = "2026-11-09";
  const oneReservation = {
    entryKind: "reservation" as const,
    id: "reservation-1", status: "confirmed" as const,
    startAt: "2026-11-13T02:00:00.000Z", endAt: "2026-11-13T04:00:00.000Z",
    customerName: null, customerPhoneE164: null,
    lighting: "with_lights" as const, netHeightCm: null,
    hourlyRate: 50, totalAmount: 100, currency: "PEN", source: "admin" as const,
    blockReason: null, internalNote: null,
  };
  const block = {
    entryKind: "block" as const,
    id: "block-1", status: "active" as const,
    startAt: "2026-11-12T14:00:00.000Z", endAt: "2026-11-12T15:00:00.000Z",
    customerName: null, customerPhoneE164: null,
    lighting: null, netHeightCm: null, hourlyRate: null, totalAmount: null,
    currency: "PEN", source: null, blockReason: "maintenance" as const, internalNote: null,
  };
  const buildDays = (courtId: string, courtName: string): AdminScheduleDay[] =>
    Array.from({ length: 7 }, (_, index) => ({
      businessId: "san-sebastian", courtId, courtName,
      bookingIncrementMinutes: 60,
      date: addDays(from, index), isOpen: true,
      opensAt: "08:00", closesAt: "23:00", scheduleStatus: "confirmed" as const,
      // Un snapshot puede repetir una entidad en más de una fecha; no se
      // deben duplicar importes de reservas al resumir.
      entries: courtId === "campo2" && index === 3 ? [oneReservation, block] :
        courtId === "campo2" && index === 4 ? [oneReservation] : [],
    }));
  return {
    from, to: "2026-11-15", timezone: "America/Lima", bookingIncrementMinutes: 60,
    courts: [
      { courtId: "campo1", courtName: "Campo 1", days: buildDays("campo1", "Campo 1") },
      { courtId: "campo2", courtName: "Campo 2", days: buildDays("campo2", "Campo 2") },
    ],
  };
}

test("centro profesional no mezcla agendas, no duplica valor y cuenta bloqueos reales", () => {
  const [one, two] = buildCourtWeekIndicators(weekFixture(), new Date("2026-11-09T00:00:00Z"));
  assert.equal(one.capacityHours, 105);
  assert.equal(two.capacityHours, 105);
  assert.equal(one.occupiedHours, 0);
  assert.equal(one.confirmedCount, 0);
  assert.equal(two.confirmedCount, 1);
  assert.equal(two.reservedHours, 2);
  assert.equal(two.occupiedHours, 3);
  assert.equal(two.occupancyPercent, 2.9);
  assert.equal(two.reservationValue, 100);
  assert.equal(two.activeBlocks, 1);
});

test("nueva presentación mantiene las mutaciones seguras y no habilita pago/reserva pública automática", () => {
  const board = readFileSync("components/availability/SanSebastianBookingBoard.tsx", "utf8");
  const admin = readFileSync("components/admin/AdminScheduleBoard.tsx", "utf8");
  const page = readFileSync("app/admin/(protected)/disponibilidad/page.tsx", "utf8");
  const metrics = readFileSync("lib/admin/weeklyCommand.ts", "utf8");
  assert.match(board, /consecutiveAvailableEnd/);
  assert.match(board, /buildWhatsAppChatHref/);
  assert.match(board, /no bloquea el campo ni crea una reserva o pago automático/);
  assert.match(board, /ss-booking-board__progress/);
  assert.match(board, /freeStartsForDate/);
  assert.match(admin, /confirmReservationAction/);
  assert.match(admin, /createManualReservationAction/);
  assert.match(admin, /createScheduleBlockAction/);
  assert.match(admin, /canPerformAdminOperation/);
  assert.match(admin, /Comparar campos/);
  assert.match(admin, /no es dinero cobrado/);
  assert.match(page, /premiumCommand=\{context\.businessId === "73426eb7-4a4f-405b-b0bd-be06cd53aa3f"\}/);
  assert.doesNotMatch(metrics, /supabase\.from|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});
