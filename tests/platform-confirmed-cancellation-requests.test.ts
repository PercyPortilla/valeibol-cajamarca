import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025103000_block39_confirmed_cancellation_requests.sql", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const customerUi = readFileSync("components/account/CustomerReservationCancellationRequest.tsx", "utf8");
const adminPage = readFileSync("app/admin/(protected)/reservas/page.tsx", "utf8");
const adminUi = readFileSync("components/admin/AdminReservationChangeRequests.tsx", "utf8");
const actions = readFileSync("app/admin/(protected)/actions.ts", "utf8");
const operations = readFileSync("lib/admin/operations.ts", "utf8");

test("B39 cliente solo solicita cancelación de su CONFIRMED futura", () => {
  const fn = migration.match(/create or replace function public\.request_my_reservation_cancellation[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /auth\.uid\(\)/);
  assert.match(fn, /r\.user_id = v_uid/);
  assert.match(fn, /v_reservation\.status <> 'confirmed'/);
  assert.match(fn, /v_reservation\.start_at <= now\(\)/);
  assert.doesNotMatch(fn, /p_business_id|p_user_id/i);
});

test("B39 resolución es owner/admin y cancela atómicamente la reserva", () => {
  const fn = migration.match(/create or replace function public\.admin_resolve_reservation_change_request[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /v_actor\.role not in \('owner','admin'\)/);
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q", reservationLock + 1);
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /set status = 'cancelled'/);
  assert.match(fn, /status = case when p_approve then 'approved' else 'rejected' end/);
});

test("B39 UX cliente y admin exponen workflow sin cancelación directa cliente", () => {
  assert.match(account, /CustomerReservationCancellationRequest/);
  assert.match(customerUi, /request_my_reservation_cancellation/);
  assert.match(customerUi, /sigue confirmada/i);
  assert.match(adminPage, /AdminReservationChangeRequests/);
  assert.match(adminUi, /resolveReservationChangeRequestAction/);
  assert.match(actions, /admin_resolve_reservation_change_request/);
  assert.match(operations, /resolve_change_request/);
  assert.match(adminUi, /Aprobar cancelación/);
});

