import assert from "node:assert/strict";
import test from "node:test";
import {
  canPerformAdminOperation,
  reservationTransition,
  blockReasonLabel,
} from "../lib/admin/operations.ts";
import {
  adminEntryBlocksAvailability,
  buildAdminBoardSlots,
  getAdminWeekRange,
  getLocalDateTimeParts,
  type AdminScheduleDay,
} from "../lib/admin/schedule.ts";
import { calculateBookingPreview } from "../lib/booking.ts";

const baseDay: AdminScheduleDay = {
  businessId: "11111111-1111-4111-8111-111111111111",
  bookingIncrementMinutes: 60,
  courtId: "22222222-2222-4222-8222-222222222222",
  courtName: "Cancha principal",
  date: "2026-10-20",
  isOpen: true,
  opensAt: "18:00",
  closesAt: "22:00",
  scheduleStatus: "provisional",
  entries: [],
};

test("owner y admin pueden editar; staff opera agenda pero no reescribe reservas", () => {
  for (const role of ["owner", "admin"] as const) {
    assert.equal(canPerformAdminOperation(role, "edit_reservation"), true);
    assert.equal(canPerformAdminOperation(role, "archive_reservation"), true);
    assert.equal(canPerformAdminOperation(role, "restore_archived_reservation"), true);
    assert.equal(canPerformAdminOperation(role, "create_block"), true);
  }
  assert.equal(canPerformAdminOperation("staff", "confirm_reservation"), true);
  assert.equal(canPerformAdminOperation("staff", "complete_reservation"), true);
  assert.equal(canPerformAdminOperation("staff", "cancel_reservation"), true);
  assert.equal(canPerformAdminOperation("staff", "create_manual_reservation"), true);
  assert.equal(canPerformAdminOperation("staff", "create_block"), true);
  assert.equal(canPerformAdminOperation("staff", "unblock"), true);
  assert.equal(canPerformAdminOperation("staff", "edit_reservation"), false);
  assert.equal(canPerformAdminOperation("staff", "archive_reservation"), false);
  assert.equal(canPerformAdminOperation("staff", "restore_archived_reservation"), false);
});

test("pending -> confirmed y confirmed -> confirmed es idempotente", () => {
  assert.deepEqual(reservationTransition("pending", "confirm"), {
    allowed: true,
    nextStatus: "confirmed",
    idempotent: false,
  });
  assert.deepEqual(reservationTransition("confirmed", "confirm"), {
    allowed: true,
    nextStatus: "confirmed",
    idempotent: true,
  });
  assert.deepEqual(reservationTransition("confirmed", "complete"), {
    allowed: true,
    nextStatus: "completed",
    idempotent: false,
  });
  assert.deepEqual(reservationTransition("completed", "complete"), {
    allowed: true,
    nextStatus: "completed",
    idempotent: true,
  });
  assert.deepEqual(reservationTransition("pending", "complete"), {
    allowed: false,
    reason: "invalid_status_transition",
  });
});

test("pending/confirmed -> cancelled; completed no puede cancelarse", () => {
  assert.equal(reservationTransition("pending", "cancel").allowed, true);
  assert.equal(reservationTransition("confirmed", "cancel").allowed, true);
  assert.deepEqual(reservationTransition("cancelled", "cancel"), {
    allowed: true,
    nextStatus: "cancelled",
    idempotent: true,
  });
  assert.deepEqual(reservationTransition("completed", "cancel"), {
    allowed: false,
    reason: "invalid_status_transition",
  });
});

test("una pending bloquea la pizarra y una cancelada libera el intervalo", () => {
  const pending = {
    entryKind: "reservation" as const,
    id: "r1",
    status: "pending" as const,
    startAt: "2026-10-20T23:00:00.000Z",
    endAt: "2026-10-21T00:00:00.000Z",
    customerName: "Cliente privado",
    customerPhoneE164: "+51999999999",
    lighting: "without_lights" as const,
    netHeightCm: 224,
    hourlyRate: 35,
    totalAmount: 35,
    currency: "PEN",
    source: "public_web" as const,
    blockReason: null,
    internalNote: null,
  };
  const slots = buildAdminBoardSlots({ ...baseDay, entries: [pending] }, "America/Lima", new Date("2026-10-20T20:00:00Z"));
  assert.equal(slots[0].status, "pending");
  assert.equal(adminEntryBlocksAvailability(pending), true);

  const cancelled = { ...pending, status: "cancelled" as const };
  const released = buildAdminBoardSlots({ ...baseDay, entries: [cancelled] }, "America/Lima", new Date("2026-10-20T20:00:00Z"));
  assert.equal(released[0].status, "available");
  assert.equal(released[0].releasedEntries.length, 1);
  assert.equal(adminEntryBlocksAvailability(cancelled), false);
});

test("bloqueo activo ocupa y bloqueo cancelado libera", () => {
  const block = {
    entryKind: "block" as const,
    id: "b1",
    status: "active" as const,
    startAt: "2026-10-21T00:00:00.000Z",
    endAt: "2026-10-21T01:00:00.000Z",
    customerName: null,
    customerPhoneE164: null,
    lighting: null,
    netHeightCm: null,
    hourlyRate: null,
    totalAmount: null,
    currency: "PEN",
    source: null,
    blockReason: "maintenance" as const,
    internalNote: "Prueba",
  };
  const slots = buildAdminBoardSlots({ ...baseDay, entries: [block] }, "America/Lima", new Date("2026-10-20T20:00:00Z"));
  assert.equal(slots[1].status, "blocked");
  assert.equal(blockReasonLabel("maintenance"), "Mantenimiento");

  const cancelled = { ...block, status: "cancelled" as const };
  const released = buildAdminBoardSlots({ ...baseDay, entries: [cancelled] }, "America/Lima", new Date("2026-10-20T20:00:00Z"));
  assert.equal(released[1].status, "available");
});

test("franjas contiguas no se intersectan en la derivación de la pizarra", () => {
  const first = {
    entryKind: "reservation" as const,
    id: "r1",
    status: "confirmed" as const,
    startAt: "2026-10-20T23:00:00.000Z", // 18:00 Lima
    endAt: "2026-10-21T00:00:00.000Z",   // 19:00 Lima
    customerName: "A",
    customerPhoneE164: "+51911111111",
    lighting: "without_lights" as const,
    netHeightCm: 243,
    hourlyRate: 35,
    totalAmount: 35,
    currency: "PEN",
    source: "admin" as const,
    blockReason: null,
    internalNote: null,
  };
  const second = { ...first, id: "r2", startAt: "2026-10-21T00:00:00.000Z", endAt: "2026-10-21T01:00:00.000Z" };
  const slots = buildAdminBoardSlots({ ...baseDay, entries: [first, second] }, "America/Lima", new Date("2026-10-20T20:00:00Z"));
  assert.equal(slots[0].entry?.id, "r1");
  assert.equal(slots[1].entry?.id, "r2");
});

test("la reserva manual sigue mostrando S/35 y S/60 desde configuración central", () => {
  assert.equal(calculateBookingPreview("18:00", "19:00", "without_lights").total, 35);
  assert.equal(calculateBookingPreview("18:00", "19:00", "with_lights").total, 60);
  assert.equal(calculateBookingPreview("18:00", "20:00", "with_lights").total, 120);
});

test("America/Lima transforma correctamente la fecha/hora administrativa", () => {
  assert.deepEqual(getLocalDateTimeParts("2026-10-20T23:00:00.000Z", "America/Lima"), {
    date: "2026-10-20",
    time: "18:00",
  });
});

test("semana administrativa empieza lunes y cubre siete días", () => {
  assert.deepEqual(getAdminWeekRange("2026-10-22"), { from: "2026-10-19", to: "2026-10-25" });
});

test("un intervalo pasado sin ocupación se marca no disponible en admin", () => {
  const slots = buildAdminBoardSlots(baseDay, "America/Lima", new Date("2026-10-21T03:00:00Z")); // 22:00 Lima
  assert.ok(slots.every((slot) => slot.status === "unavailable"));
});
