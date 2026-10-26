import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025140000_block45_business_proposal_withdrawal.sql", "utf8");
const actions = readFileSync("app/admin/(protected)/actions.ts", "utf8");
const operations = readFileSync("lib/admin/operations.ts", "utf8");
const adminUi = readFileSync("components/admin/AdminReservationChangeRequests.tsx", "utf8");
const notifications = readFileSync("lib/notifications.ts", "utf8");
const audit = readFileSync("lib/admin/reservationAudit.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function functionBody(name: string) {
  return migration.match(new RegExp("create or replace function public\\." + name + "[\\s\\S]*?\\$\\$;", "i"))?.[0] ?? "";
}

test("B45 distingue retiro del negocio sin añadir un nuevo status", () => {
  assert.match(migration, /add column if not exists resolution_kind text/);
  assert.match(migration, /business_withdrawal/);
  assert.match(migration, /business_expiration/);
  assert.match(migration, /customer_response/);
  assert.match(migration, /admin_resolution/);
  assert.match(migration, /status = 'pending' and resolution_kind is null/);
  assert.match(migration, /initiator_kind = 'customer' and resolution_kind = 'admin_resolution'/);
  assert.match(migration, /initiator_kind = 'business' and resolution_kind = 'customer_response'/);
  assert.doesNotMatch(migration, /status in \([^)]*withdrawn/i);
});

test("B45 retiro admin respeta tenant y orden reservation -> change request", () => {
  const fn = functionBody("admin_withdraw_business_reschedule_proposal");
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q", fn.indexOf("for update"));
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /v_actor\.role not in \('owner','admin'\)/);
  assert.match(fn, /q\.business_id = v_actor\.business_id/);
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /from public\.reservations r[\s\S]*for update/i);
  assert.match(fn, /from public\.reservation_change_requests q[\s\S]*for update/i);
  assert.match(fn, /q\.initiator_kind = 'business'/);
  assert.match(fn, /q\.request_type = 'reschedule'/);
});

test("B45 retiro es idempotente y nunca modifica la reserva", () => {
  const fn = functionBody("admin_withdraw_business_reschedule_proposal");
  assert.match(fn, /v_request\.status = 'rejected' and v_request\.resolution_kind = 'business_withdrawal'/);
  assert.match(fn, /business_reschedule_proposal_expired_requires_expiration/);
  assert.match(fn, /v_reservation\.start_at <= now\(\)/);
  assert.match(fn, /coalesce\(v_request\.requested_start_at, v_reservation\.start_at\) <= now\(\)/);
  assert.match(fn, /status = 'rejected'/);
  assert.match(fn, /resolution_kind = 'business_withdrawal'/);
  assert.match(fn, /resolved_by = v_actor\.user_id/);
  assert.doesNotMatch(fn, /update public\.reservations/i);
});

test("B45 expiración solo cierra propuestas temporalmente vencidas", () => {
  const fn = functionBody("admin_expire_business_reschedule_proposal");
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q", fn.indexOf("for update"));
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /v_actor\.role not in \('owner','admin'\)/);
  assert.match(fn, /v_request\.resolution_kind = 'business_expiration'/);
  assert.match(fn, /v_reservation\.start_at > now\(\)/);
  assert.match(fn, /coalesce\(v_request\.requested_start_at, v_reservation\.start_at\) > now\(\)/);
  assert.match(fn, /business_reschedule_proposal_not_expired/);
  assert.doesNotMatch(fn, /update public\.reservations/i);
});

test("B45 guard solo permite retiro OWNER ADMIN y conserva respuesta cliente B44", () => {
  const guard = functionBody("block44_guard_business_proposal_resolution");
  assert.match(guard, /new\.resolution_kind in \('business_withdrawal','business_expiration'\)/);
  assert.match(guard, /phase6_admin_actor\(\)/);
  assert.match(guard, /v_actor\.business_id <> old\.business_id/);
  assert.match(guard, /new\.status <> 'rejected'/);
  assert.match(guard, /new\.resolved_by is distinct from v_actor\.user_id/);
  assert.match(guard, /new\.resolution_kind = 'customer_response' and auth\.uid\(\) = old\.user_id/);
});

test("B45 respuesta cliente no confunde un retiro del negocio con rechazo idempotente", () => {
  const respond = functionBody("respond_to_business_reschedule_proposal");
  assert.match(respond, /v_request\.resolution_kind = 'customer_response'/);
  assert.match(respond, /change_request_already_resolved/);
  assert.match(respond, /resolution_kind = 'customer_response'/);
  const terminalIndex = respond.indexOf("if v_request.status <> 'pending' then");
  const resolutionKindIndex = respond.indexOf("v_request.resolution_kind = 'customer_response'", terminalIndex);
  assert.ok(terminalIndex >= 0 && resolutionKindIndex > terminalIndex);
});

test("B45 notifica al cliente y audita el retiro con evento propio", () => {
  for (const source of [migration, notifications, audit, types]) {
    assert.match(source, /reschedule_proposal_withdrawn/);
    assert.match(source, /reschedule_proposal_expired/);
  }
  const notify = functionBody("block41_queue_change_request_notification");
  const auditFn = functionBody("block42_audit_change_request");
  assert.match(notify, /resolution_kind in \('business_withdrawal','business_expiration'\)/);
  assert.match(notify, /'customer'/);
  assert.match(notify, /reschedule_proposal_withdrawn/);
  assert.match(notify, /reschedule_proposal_expired/);
  assert.match(auditFn, /resolution_kind = 'business_withdrawal'[\s\S]*reschedule_proposal_withdrawn/);
  assert.match(auditFn, /resolution_kind = 'business_expiration'[\s\S]*reschedule_proposal_expired/);
});

test("B45 UI ofrece retirar solo propuestas business para owner/admin", () => {
  assert.match(operations, /"withdraw_reschedule_proposal"/);
  assert.match(operations, /"expire_reschedule_proposal"/);
  assert.match(actions, /admin_withdraw_business_reschedule_proposal/);
  assert.match(actions, /business_reschedule_proposal_expired_requires_expiration/);
  assert.match(actions, /admin_expire_business_reschedule_proposal/);
  assert.match(adminUi, /withdrawBusinessRescheduleProposalAction/);
  assert.match(adminUi, /expireBusinessRescheduleProposalAction/);
  assert.match(adminUi, /request\.initiator_kind === "business"/);
  assert.match(adminUi, /Retirar propuesta/);
  assert.match(adminUi, /Expirar propuesta/);
  assert.match(adminUi, /proposalExpired/);
  assert.match(adminUi, /canResolve/);
  assert.match(types, /admin_withdraw_business_reschedule_proposal/);
  assert.match(types, /admin_expire_business_reschedule_proposal/);
  assert.match(sqlRunner, /platform_business_proposal_withdrawal\.sql/);
});
