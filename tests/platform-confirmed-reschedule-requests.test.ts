import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025110000_block40_confirmed_reschedule_requests.sql", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const customerUi = readFileSync("components/account/CustomerReservationRescheduleRequest.tsx", "utf8");
const adminUi = readFileSync("components/admin/AdminReservationChangeRequests.tsx", "utf8");
const scheduleBoard = readFileSync("components/admin/AdminScheduleBoard.tsx", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B40 cliente solicita reprogramación propia sin mover la reserva", () => {
  const fn = migration.match(/create or replace function public\.request_my_reservation_reschedule[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /auth\.uid\(\)/);
  assert.match(fn, /r\.user_id = v_uid/);
  assert.match(fn, /v_reservation\.status <> 'confirmed'/);
  assert.match(fn, /phase6_resolve_window/);
  assert.match(fn, /resolve_booking_lighting/);
  assert.doesNotMatch(fn, /update public\.reservations/i);
});

test("B40 valida disponibilidad, pricing y pagos antes de crear solicitud", () => {
  const fn = migration.match(/create or replace function public\.request_my_reservation_reschedule[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /pg_advisory_xact_lock/);
  assert.match(fn, /court_schedule_entries/);
  assert.match(fn, /slot_unavailable/);
  assert.match(fn, /reservation_payments/);
  assert.match(fn, /v_payment\.amount <> v_total/);
  assert.match(fn, /v_payment\.currency <> v_currency/);
  assert.match(fn, /reservation_payment_requires_business_reschedule/);
});

test("B40 solo considera idempotente el mismo destino exacto", () => {
  const fn = migration.match(/create or replace function public\.request_my_reservation_reschedule[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /v_request\.requested_court_id = p_court_id/);
  assert.match(fn, /v_request\.requested_start_at = v_window\.start_at/);
  assert.match(fn, /v_request\.requested_end_at = v_window\.end_at/);
  assert.match(fn, /reservation_change_request_already_pending/);
});

test("B40 aprobación revalida, exige quote estable y mueve reserva atómicamente", () => {
  const fn = migration.match(/create or replace function public\.admin_resolve_reservation_change_request[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /v_request\.request_type = 'reschedule'/);
  assert.match(fn, /phase6_resolve_window/);
  assert.match(fn, /reschedule_quote_changed/);
  assert.match(fn, /update public\.reservations/);
  assert.match(fn, /exception when exclusion_violation/);
  assert.match(fn, /slot_unavailable/);
});

test("B40 cierra bypass de edición directa de CONFIRMED", () => {
  const fn = migration.match(/create or replace function public\.admin_edit_reservation[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /confirmed_reschedule_requires_request/);
  assert.match(scheduleBoard, /entry\.status === "pending"[\s\S]*new Date\(entry\.startAt\)\.getTime\(\) > new Date\(nowIso\)\.getTime\(\)[\s\S]*canPerformAdminOperation\(role, "edit_reservation"\)/);
  assert.doesNotMatch(scheduleBoard, /entry\.status === "pending" \|\| entry\.status === "confirmed"[^\n]*edit_reservation/);
});

test("B40 UX usa disponibilidad real y mantiene horario original hasta aprobación", () => {
  assert.match(account, /CustomerReservationRescheduleRequest/);
  assert.match(customerUi, /createPublicAvailabilityRepository/);
  assert.match(customerUi, /request_my_reservation_reschedule/);
  assert.match(customerUi, /horario original sigue reservado/i);
  assert.match(adminUi, /Aprobar reprogramación/);
  assert.match(adminUi, /Valor estimado/);
  assert.match(sqlRunner, /platform_confirmed_reschedule_requests\.sql/);
});

