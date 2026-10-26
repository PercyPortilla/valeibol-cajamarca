import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025190000_block54_confirmed_cancellation_closure_consistency.sql", "utf8");
const b48 = readFileSync("supabase/migrations/20261025160000_block48_pending_rejection_semantics.sql", "utf8");
const b47 = readFileSync("supabase/migrations/20261025153000_block47_customer_change_request_withdrawal.sql", "utf8");
const b41 = readFileSync("supabase/migrations/20261025113000_block41_notification_center.sql", "utf8");
const b49 = readFileSync("supabase/migrations/20261025163000_block49_pending_reservation_expiration.sql", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function resolverBody() {
  return migration.match(/create or replace function public\.admin_resolve_reservation_change_request[\s\S]*?\$\$;/i)?.[0] ?? "";
}

test("B54 aprobación de cancelación usa la misma semántica confirmed_cancellation de B48", () => {
  const fn = resolverBody();
  assert.match(b48, /admin_cancel_reservation[\s\S]*closure_kind = 'confirmed_cancellation'/);
  const cancellationBranch = fn.match(/if p_approve and v_request\.request_type = 'cancellation'[\s\S]*?elsif p_approve and v_request\.request_type = 'reschedule'/)?.[0] ?? "";
  const statusUpdate = cancellationBranch.match(/update public\.reservations r[\s\S]*?returning r\.\* into v_reservation;/)?.[0] ?? "";
  assert.match(statusUpdate, /set status = 'cancelled'/);
  assert.doesNotMatch(statusUpdate, /closure_kind/);
  assert.match(cancellationBranch, /update public\.reservations r[\s\S]*set closure_kind = 'confirmed_cancellation'[\s\S]*returning r\.\* into v_reservation/);
  assert.match(account, /closureKind === "confirmed_cancellation"[\s\S]*Esta reserva fue cancelada después de su confirmación/);
});

test("B54 mantiene lock order y seguridad tenant de B52", () => {
  const fn = resolverBody();
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /v_actor\.role not in \('owner','admin'\)/);
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q", reservationLock + 1);
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /from public\.reservations r[\s\S]*for update/);
  assert.match(fn, /from public\.reservation_change_requests q[\s\S]*for update/);
});

test("B54 retry aprobado exige también que la reserva tenga cierre consistente", () => {
  const fn = resolverBody();
  assert.match(fn, /v_request\.resolution_note is not distinct from v_note/);
  assert.match(fn, /v_request\.request_type = 'cancellation'[\s\S]*v_reservation\.status = 'cancelled'[\s\S]*v_reservation\.closure_kind = 'confirmed_cancellation'/);
});

test("B54 evita doble notificación usando closure_kind en un segundo UPDATE", () => {
  const fn = resolverBody();
  const cancellationBranch = fn.match(/if p_approve and v_request\.request_type = 'cancellation'[\s\S]*?elsif p_approve and v_request\.request_type = 'reschedule'/)?.[0] ?? "";
  assert.ok(cancellationBranch.indexOf("set status = 'cancelled'") < cancellationBranch.indexOf("set closure_kind = 'confirmed_cancellation'"));
  assert.match(b41, /after insert or update of status, user_id on public\.reservations/);
  assert.match(b47, /new\.request_type = 'cancellation' and new\.status = 'approved' then 'cancellation_approved'/);
  assert.match(b49, /after update of status, closure_kind on public\.reservations[\s\S]*block49_queue_pending_expiration_notification/);
  assert.match(b49, /old\.status = 'pending'[\s\S]*new\.closure_kind = 'request_expiration'/);
});

test("B54 backfill solo clasifica cierres con evidencia fuerte de solicitud aprobada", () => {
  assert.match(migration, /update public\.reservations r[\s\S]*r\.status = 'cancelled'[\s\S]*r\.closure_kind is null/);
  assert.match(migration, /q\.user_id = r\.user_id/);
  assert.match(migration, /q\.initiator_kind = 'customer'/);
  assert.match(migration, /q\.request_type = 'cancellation'/);
  assert.match(migration, /q\.status = 'approved'/);
  assert.match(migration, /q\.resolution_kind = 'admin_resolution'/);
});

test("B54 conserva privilegios encapsulados y registra contrato SQL", () => {
  assert.match(migration, /revoke all on function public\.admin_resolve_reservation_change_request\(uuid, boolean, text\)[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_resolve_reservation_change_request\(uuid, boolean, text\)[\s\S]*to authenticated/);
  assert.match(runner, /platform_confirmed_cancellation_closure_consistency\.sql/);
});
