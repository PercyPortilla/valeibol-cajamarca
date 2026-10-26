import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025123000_block43_change_request_lifecycle.sql", "utf8");
const cancellationUi = readFileSync("components/account/CustomerReservationCancellationRequest.tsx", "utf8");
const rescheduleUi = readFileSync("components/account/CustomerReservationRescheduleRequest.tsx", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const adminRepository = readFileSync("lib/data/repositories/supabaseAdminOperationsRepository.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function functionBody(name: string) {
  return migration.match(new RegExp("create or replace function public\\." + name + "[\\s\\S]*?\\$\\$;", "i"))?.[0] ?? "";
}

test("B43 serializa cancelación administrativa frente a change requests pendientes", () => {
  const fn = functionBody("admin_cancel_reservation");
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q");
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /from public\.reservations r[\s\S]*for update/i);
  assert.match(fn, /from public\.reservation_change_requests q[\s\S]*q\.status = 'pending'[\s\S]*for update/i);
  assert.match(fn, /reservation_change_request_pending/);
});

test("B43 impide completar una reserva dejando una solicitud B39-B40 colgada", () => {
  const fn = functionBody("admin_complete_reservation");
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q");
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /v_reservation\.end_at > now\(\)/);
  assert.match(fn, /q\.status = 'pending'/);
  assert.match(fn, /reservation_change_request_pending/);
});

test("B43 devuelve feedback específico cuando un cambio pendiente bloquea la transición", () => {
  assert.match(adminRepository, /reservation_change_request_pending/);
  assert.match(adminRepository, /solicitud de cambio pendiente/i);
});

test("B43 permite reintentar cancelación o reprogramación después de una solicitud resuelta", () => {
  assert.match(cancellationUi, /canRequest/);
  assert.match(rescheduleUi, /canRequest/);
  assert.match(cancellationUi, new RegExp('requestStatus === "rejected"[\\s\\S]*canRequest'));
  assert.match(rescheduleUi, new RegExp('requestStatus === "rejected"[\\s\\S]*canRequest'));
  assert.doesNotMatch(cancellationUi, /if \(requestStatus === "rejected"\) return/);
  assert.doesNotMatch(rescheduleUi, /if \(requestStatus === "rejected"\) return/);
  assert.match(account, /canRequest=\{reservation\.can_request_cancellation\}/);
  assert.match(account, /canRequest=\{reservation\.can_request_reschedule\}/);
});

test("B43 sincroniza SQL runner", () => {
  assert.match(sqlRunner, /platform_change_request_lifecycle\.sql/);
});

