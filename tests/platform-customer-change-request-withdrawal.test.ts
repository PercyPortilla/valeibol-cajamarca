import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025153000_block47_customer_change_request_withdrawal.sql", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const withdrawalUi = readFileSync("components/account/CustomerChangeRequestWithdrawalButton.tsx", "utf8");
const cancellationUi = readFileSync("components/account/CustomerReservationCancellationRequest.tsx", "utf8");
const rescheduleUi = readFileSync("components/account/CustomerReservationRescheduleRequest.tsx", "utf8");
const notifications = readFileSync("lib/notifications.ts", "utf8");
const audit = readFileSync("lib/admin/reservationAudit.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const b46 = readFileSync("supabase/migrations/20261025150000_block46_customer_change_request_expiration.sql", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function functionBody(name: string) {
  return migration.match(new RegExp("create or replace function public\\." + name + "[\\s\\S]*?\\$\\$;", "i"))?.[0] ?? "";
}

test("B47 añade customer_withdrawal sin crear status nuevo", () => {
  assert.match(migration, /resolution_kind in \('customer_expiration','customer_withdrawal'\)/);
  assert.match(migration, /status = 'rejected'/);
  assert.doesNotMatch(migration, /status in \([^)]*withdrawn/i);
});

test("B47 deriva identidad desde auth y exige cuenta activa y ownership", () => {
  const fn = functionBody("withdraw_my_reservation_change_request");
  assert.match(fn, /v_uid uuid := auth\.uid\(\)/);
  assert.match(fn, /user_accounts ua[\s\S]*ua\.user_id = v_uid[\s\S]*ua\.is_active/);
  assert.match(fn, /q\.user_id = v_uid/);
  assert.match(fn, /q\.initiator_kind = 'customer'/);
  assert.match(fn, /r\.user_id = v_uid/);
  assert.doesNotMatch(fn, /p_business_id|p_user_id|p_status|p_resolution_kind/);
});

test("B47 conserva lock order reservation -> request y nunca modifica reserva", () => {
  const fn = functionBody("withdraw_my_reservation_change_request");
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q", fn.indexOf("for update"));
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /from public\.reservations r[\s\S]*for update/i);
  assert.match(fn, /from public\.reservation_change_requests q[\s\S]*for update/i);
  assert.doesNotMatch(fn, /update public\.reservations/i);
});

test("B47 idempotencia exacta solo reconoce retiro propio", () => {
  const fn = functionBody("withdraw_my_reservation_change_request");
  assert.match(fn, /v_request\.status = 'rejected'/);
  assert.match(fn, /v_request\.resolution_kind = 'customer_withdrawal'/);
  assert.match(fn, /v_request\.resolved_by = v_uid/);
  assert.match(fn, /customer_change_request_already_resolved/);
  assert.match(fn, /resolution_kind = 'customer_withdrawal'/);
});

test("B47 no permite convertir una solicitud vencida en retiro", () => {
  const fn = functionBody("withdraw_my_reservation_change_request");
  assert.match(fn, /v_reservation\.status <> 'confirmed'/);
  assert.match(fn, /v_reservation\.start_at <= now\(\)/);
  assert.match(fn, /v_request\.requested_start_at is null or v_request\.requested_start_at <= now\(\)/);
  assert.match(fn, /customer_change_request_expired_requires_expiration/);
});

test("B47 es race-safe frente a resolver y expirar admin", () => {
  const fn = functionBody("withdraw_my_reservation_change_request");
  const adminResolve = b46.match(/create or replace function public\.admin_resolve_reservation_change_request[\s\S]*?\$\$;/i)?.[0] ?? "";
  const adminExpire = b46.match(/create or replace function public\.admin_expire_customer_change_request[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /status <> 'pending'/);
  assert.match(adminResolve, /resolution_kind = 'admin_resolution'/);
  assert.match(adminExpire, /resolution_kind = 'customer_expiration'/);
  assert.match(adminResolve, /change_request_already_resolved/);
  assert.match(adminExpire, /customer_change_request_already_resolved/);
});

test("B47 UI permite retirar pending y distingue retiro de rechazo", () => {
  assert.match(withdrawalUi, /withdraw_my_reservation_change_request/);
  assert.match(withdrawalUi, /Retirar solicitud/);
  assert.match(withdrawalUi, /Sí, retirar solicitud/);
  assert.match(account, /requestId=\{cancellationRequest\?\.request_id \?\? null\}/);
  assert.match(account, /requestId=\{rescheduleRequest\?\.request_id \?\? null\}/);
  assert.match(cancellationUi, /requestStatus === "pending"[\s\S]*CustomerChangeRequestWithdrawalButton/);
  assert.match(rescheduleUi, /requestStatus === "pending"[\s\S]*CustomerChangeRequestWithdrawalButton/);
  assert.match(cancellationUi, /canWithdrawPending/);
  assert.match(rescheduleUi, /canWithdrawPending/);
  assert.match(account, /cancellationRequest\?\.can_withdraw_request \?\? false/);
  assert.match(account, /rescheduleRequest\?\.can_withdraw_request \?\? false/);
  assert.match(cancellationUi, /resolutionKind === "customer_withdrawal"/);
  assert.match(rescheduleUi, /resolutionKind === "customer_withdrawal"/);
});

test("B47 expone can_withdraw_request desde PostgreSQL sin reloj de página", () => {
  assert.match(migration, /can_withdraw_request boolean/);
  assert.match(migration, /r\.status = 'confirmed'/);
  assert.match(migration, /r\.start_at > now\(\)/);
  assert.match(migration, /q\.requested_start_at is not null and q\.requested_start_at > now\(\)/);
  assert.match(types, /can_withdraw_request: boolean/);
  assert.doesNotMatch(account, /Date\.now\(\)|renderedAtMs/);
});

test("B47 notifica admin y audita actor customer sin falso rechazo", () => {
  const notify = functionBody("block41_queue_change_request_notification");
  const auditFn = functionBody("block42_audit_change_request");
  for (const source of [migration, notifications, audit, types]) {
    assert.match(source, /cancellation_withdrawn/);
    assert.match(source, /reschedule_withdrawn/);
  }
  assert.match(notify, /resolution_kind = 'customer_withdrawal'[\s\S]*'admin'/);
  assert.match(auditFn, /resolution_kind = 'customer_withdrawal'[\s\S]*cancellation_withdrawn/);
  assert.match(auditFn, /resolution_kind = 'customer_withdrawal'[\s\S]*reschedule_withdrawn/);
  assert.match(auditFn, /when new\.resolution_kind = 'customer_withdrawal' then 'customer'/);
});

test("B47 integra RPC, SQL runner y tipos", () => {
  assert.match(types, /withdraw_my_reservation_change_request/);
  assert.match(sqlRunner, /platform_customer_change_request_withdrawal\.sql/);
  assert.match(migration, /revoke all on function public\.withdraw_my_reservation_change_request\(uuid\) from public, anon/);
  assert.match(migration, /grant execute on function public\.withdraw_my_reservation_change_request\(uuid\) to authenticated/);
});
