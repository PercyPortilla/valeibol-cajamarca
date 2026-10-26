import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025160000_block48_pending_rejection_semantics.sql", "utf8");
const actions = readFileSync("app/admin/(protected)/actions.ts", "utf8");
const operations = readFileSync("lib/admin/operations.ts", "utf8");
const reservationActions = readFileSync("components/admin/AdminReservationActions.tsx", "utf8");
const scheduleBoard = readFileSync("components/admin/AdminScheduleBoard.tsx", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const withdrawal = readFileSync("components/account/CustomerReservationActions.tsx", "utf8");
const notifications = readFileSync("lib/notifications.ts", "utf8");
const audit = readFileSync("lib/admin/reservationAudit.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const repository = readFileSync("lib/data/repositories/supabaseAdminOperationsRepository.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function functionBody(name: string) {
  return migration.match(new RegExp("(?:create or replace|create) function public\\." + name + "[\\s\\S]*?\\$\\$;", "i"))?.[0] ?? "";
}

test("B48 mantiene cuatro status y añade closure_kind semántico", () => {
  assert.match(migration, /add column if not exists closure_kind text/);
  assert.match(migration, /closure_kind in \('customer_withdrawal','business_rejection','confirmed_cancellation'\)/);
  assert.match(types, /ReservationStatus = "pending" \| "confirmed" \| "cancelled" \| "completed"/);
  assert.doesNotMatch(types, /ReservationStatus[^\n]*rejected/);
});

test("B48 hace backfill conservador de retiros B30 históricos", () => {
  assert.match(migration, /update public\.reservations r[\s\S]*set closure_kind = 'customer_withdrawal'/);
  assert.match(migration, /r\.status = 'cancelled'/);
  assert.match(migration, /r\.source = 'public_web'/);
  assert.match(migration, /r\.last_modified_by = r\.user_id/);
  assert.match(migration, /ae\.event_type = 'reservation_cancelled'[\s\S]*ae\.actor_kind = 'customer'/);
  assert.match(migration, /not exists \([\s\S]*from public\.profiles p[\s\S]*p\.business_id = r\.business_id/);
  assert.match(migration, /not exists \([\s\S]*from public\.user_accounts ua[\s\S]*ua\.role = 'admin'/);
  assert.match(migration, /reservation_change_requests q[\s\S]*q\.status = 'approved'/);
  assert.match(migration, /case ae\.old_status[\s\S]*when 'pending' then 'business_rejection'[\s\S]*when 'confirmed' then 'confirmed_cancellation'/);
  assert.match(migration, /ae\.old_status in \('pending','confirmed'\)/);
  assert.match(migration, /ae\.actor_kind in \('owner','admin','staff','platform_admin'\)/);
});

test("B48 rechazo pending usa RPC dedicada y serializa sobre la reserva", () => {
  const fn = functionBody("admin_reject_pending_reservation");
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /r\.business_id = v_actor\.business_id[\s\S]*for update/);
  assert.match(fn, /v_reservation\.status <> 'pending'/);
  assert.match(fn, /v_reservation\.source <> 'public_web'/);
  assert.match(fn, /closure_kind = 'business_rejection'/);
  assert.match(fn, /status = 'cancelled'/);
});

test("B48 carreras de decisión son first-terminal-wins", () => {
  const reject = functionBody("admin_reject_pending_reservation");
  const confirm = functionBody("admin_confirm_reservation");
  const cancel = functionBody("admin_cancel_reservation");
  assert.match(reject, /status = 'cancelled'[\s\S]*closure_kind = 'business_rejection'/);
  assert.match(reject, /pending_reservation_already_resolved/);
  assert.match(confirm, /v_reservation\.status <> 'pending'/);
  assert.match(cancel, /v_reservation\.status = 'pending'[\s\S]*pending_reservation_requires_rejection/);
  assert.match(cancel, /v_reservation\.status <> 'confirmed'/);
});

test("B48 impide confirmar una solicitud cuyo horario ya comenzó", () => {
  const confirm = functionBody("admin_confirm_reservation");
  assert.match(confirm, /v_reservation\.start_at <= now\(\)/);
  assert.match(confirm, /reservation_confirmation_window_closed/);
});

test("B48 conserva B43 al cancelar confirmed y distingue cancelación", () => {
  const cancel = functionBody("admin_cancel_reservation");
  const reservationLock = cancel.indexOf("from public.reservations r");
  const requestLock = cancel.indexOf("from public.reservation_change_requests q");
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(cancel, /q\.status = 'pending'[\s\S]*for update/);
  assert.match(cancel, /reservation_change_request_pending/);
  assert.match(cancel, /closure_kind = 'confirmed_cancellation'/);
});

test("B48 endurece retiro B30 para no falsear idempotencia tras rechazo", () => {
  const withdraw = functionBody("withdraw_my_pending_reservation");
  assert.match(withdraw, /v_reservation\.closure_kind = 'customer_withdrawal'/);
  assert.match(withdraw, /v_reservation\.last_modified_by = v_uid/);
  assert.match(withdraw, /closure_kind = 'customer_withdrawal'/);
  assert.match(withdraw, /reservation_not_withdrawable/);
  assert.match(withdrawal, /Solicitud retirada/);
});

test("B48 notifica y audita rechazo retiro y cancelación con eventos distintos", () => {
  for (const source of [migration, notifications, audit, types]) {
    assert.match(source, /reservation_rejected/);
    assert.match(source, /reservation_cancelled/);
    assert.match(source, /reservation_withdrawn/);
  }
  const notify = functionBody("block41_queue_reservation_notification");
  const auditFn = functionBody("block42_audit_reservation");
  assert.match(notify, /closure_kind = 'business_rejection'[\s\S]*reservation_rejected/);
  assert.match(notify, /closure_kind = 'confirmed_cancellation'[\s\S]*reservation_cancelled/);
  assert.match(notify, /closure_kind = 'customer_withdrawal'[\s\S]*reservation_withdrawn/);
  assert.match(auditFn, /new\.closure_kind = 'business_rejection'[\s\S]*reservation_rejected/);
  assert.match(auditFn, /new\.closure_kind = 'customer_withdrawal'[\s\S]*reservation_withdrawn/);
});

test("B48 UI separa Confirmar Rechazar de Cancelar y Mi cuenta muestra causa real", () => {
  assert.match(operations, /"reject_reservation"/);
  assert.match(actions, /rejectPendingReservationAction/);
  assert.match(reservationActions, /canReject/);
  assert.match(reservationActions, />\s*Rechazar\s*</);
  assert.match(reservationActions, /status === "confirmed"[\s\S]*canCancel/);
  assert.match(scheduleBoard, /rejectPendingReservationAction/);
  assert.match(scheduleBoard, /entry\.status === "pending"[\s\S]*Rechazar/);
  assert.match(scheduleBoard, /entry\.status === "confirmed"[\s\S]*Cancelar/);
  assert.match(account, /closureKind === "business_rejection"[\s\S]*Rechazada/);
  assert.match(account, /closureKind === "customer_withdrawal"[\s\S]*Retirada/);
});

test("B48 sincroniza repositorio tipos y runner SQL", () => {
  assert.match(types, /admin_reject_pending_reservation/);
  assert.match(types, /closure_kind: "customer_withdrawal" \| "business_rejection" \| "confirmed_cancellation" \| "request_expiration" \| null/);
  assert.match(repository, /admin_reject_pending_reservation/);
  assert.match(repository, /reservation_confirmation_window_closed/);
  assert.match(sqlRunner, /platform_pending_reservation_rejection\.sql/);
});
