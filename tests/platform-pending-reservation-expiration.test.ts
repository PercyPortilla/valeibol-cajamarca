import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025163000_block49_pending_reservation_expiration.sql", "utf8");
const actions = readFileSync("app/admin/(protected)/actions.ts", "utf8");
const operations = readFileSync("lib/admin/operations.ts", "utf8");
const reservationActions = readFileSync("components/admin/AdminReservationActions.tsx", "utf8");
const scheduleBoard = readFileSync("components/admin/AdminScheduleBoard.tsx", "utf8");
const availabilityPage = readFileSync("app/admin/(protected)/disponibilidad/page.tsx", "utf8");
const reservationsPage = readFileSync("app/admin/(protected)/reservas/page.tsx", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const notifications = readFileSync("lib/notifications.ts", "utf8");
const audit = readFileSync("lib/admin/reservationAudit.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const repository = readFileSync("lib/data/repositories/supabaseAdminOperationsRepository.ts", "utf8");
const localRepository = readFileSync("lib/data/repositories/localAdminOperationsRepository.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function functionBody(name: string) {
  return migration.match(new RegExp("(?:create or replace|create) function public\\." + name + "[\\s\\S]*?\\$\\$;", "i"))?.[0] ?? "";
}

test("B49 añade request_expiration sin crear un quinto reservation_status", () => {
  assert.match(migration, /closure_kind in \([\s\S]*'request_expiration'[\s\S]*\)/);
  assert.match(types, /ReservationStatus = "pending" \| "confirmed" \| "cancelled" \| "completed"/);
  assert.match(types, /request_expiration/);
});

test("B49 expira solo public_web pending vencida bajo tenant y FOR UPDATE", () => {
  const fn = functionBody("admin_expire_pending_reservation");
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /r\.business_id = v_actor\.business_id[\s\S]*for update/);
  assert.match(fn, /v_reservation\.status <> 'pending'/);
  assert.match(fn, /v_reservation\.source <> 'public_web'/);
  assert.match(fn, /v_reservation\.start_at > now\(\)[\s\S]*pending_reservation_not_expired/);
  assert.match(fn, /closure_kind = 'request_expiration'/);
});

test("B49 idempotencia exacta no confunde otros cierres", () => {
  const fn = functionBody("admin_expire_pending_reservation");
  assert.match(fn, /v_reservation\.status = 'cancelled'[\s\S]*v_reservation\.closure_kind = 'request_expiration'/);
  assert.match(fn, /pending_reservation_already_resolved/);
});

test("B49 bloquea rechazo stale y conserva reject futuro", () => {
  const fn = functionBody("admin_reject_pending_reservation");
  assert.match(fn, /v_reservation\.start_at <= now\(\)[\s\S]*pending_reservation_expired_requires_expiration/);
  assert.match(fn, /closure_kind = 'business_rejection'/);
});

test("B49 carreras confirm reject withdraw expire siguen serializando en reservation", () => {
  const expire = functionBody("admin_expire_pending_reservation");
  const reject = functionBody("admin_reject_pending_reservation");
  const edit = functionBody("admin_edit_reservation");
  assert.match(expire, /from public\.reservations r[\s\S]*for update/);
  assert.match(reject, /from public\.reservations r[\s\S]*for update/);
  assert.match(edit, /from public\.reservations r[\s\S]*for update/);
  assert.match(edit, /p_net_height_cm smallint/);
  assert.match(edit, /v_reservation\.status = 'confirmed'[\s\S]*confirmed_reschedule_requires_request/);
  assert.match(edit, /v_reservation\.start_at <= now\(\)[\s\S]*pending_reservation_expired_requires_expiration/);
  assert.match(migration, /drop function if exists public\.admin_edit_reservation\([\s\S]*public\.lighting_mode/);
  assert.match(repository, /admin_expire_pending_reservation/);
});

test("B49 backfill cierra PENDING públicas vencidas sin tocar pagos", () => {
  assert.match(migration, /update public\.reservations[\s\S]*closure_kind = 'request_expiration'[\s\S]*status = 'pending'[\s\S]*source = 'public_web'[\s\S]*start_at <= now\(\)/);
  const backfill = migration.match(/-- Normaliza las PENDING públicas[\s\S]*?revoke all on function public\.admin_expire_pending_reservation/i)?.[0] ?? "";
  assert.doesNotMatch(backfill, /update public\.reservation_payments/i);
  assert.doesNotMatch(backfill, /delete from public\.reservation_payments/i);
});

test("B49 notifica y audita expiración con evento propio", () => {
  for (const source of [migration, notifications, audit, types]) assert.match(source, /reservation_expired/);
  const notify = functionBody("block49_queue_pending_expiration_notification");
  const auditFn = functionBody("block42_audit_reservation");
  assert.match(notify, /old\.status = 'pending'[\s\S]*new\.closure_kind = 'request_expiration'[\s\S]*reservation_expired/);
  assert.match(auditFn, /new\.closure_kind = 'request_expiration'[\s\S]*reservation_expired/);
  assert.match(auditFn, /new\.closure_kind = 'request_expiration' and new\.last_modified_by is null[\s\S]*v_actor_kind := 'system'/);
});

test("B49 Mi cuenta distingue Vencida de Expirada con flag servidor", () => {
  assert.match(migration, /is_expired_pending boolean/);
  assert.match(migration, /as is_expired_pending/);
  assert.match(types, /is_expired_pending: boolean/);
  assert.match(account, /status === "pending" && isExpiredPending[\s\S]*Vencida/);
  assert.match(account, /closureKind === "request_expiration"[\s\S]*Expirada/);
});

test("B49 Admin usa tiempo renderizado por servidor y ofrece Expirar", () => {
  assert.match(reservationsPage, /const renderedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(reservationsPage, /pendingExpired[\s\S]*Vencida/);
  assert.match(reservationActions, /pendingExpired[\s\S]*canExpire/);
  assert.match(reservationActions, /expirePendingReservationAction/);
  assert.match(availabilityPage, /const renderedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(availabilityPage, /nowIso=\{renderedAt\}/);
  assert.match(scheduleBoard, /expirePendingReservationAction/);
  assert.match(scheduleBoard, />Expirar</);
  assert.match(scheduleBoard, /entry\.status === "pending" && new Date\(entry\.startAt\)\.getTime\(\) > new Date\(nowIso\)\.getTime\(\)[\s\S]*edit_reservation/);
});

test("B49 permisos tipos repositorio local y runner quedan sincronizados", () => {
  assert.match(operations, /"expire_pending_reservation"/);
  assert.match(actions, /expirePendingReservationAction/);
  assert.match(types, /admin_expire_pending_reservation/);
  assert.match(repository, /expirePendingReservation/);
  assert.match(localRepository, /expirePendingReservation/);
  assert.match(localRepository, /reservation\.status === "pending" && new Date\(reservation\.startAt\)\.getTime\(\) <= Date\.now\(\)[\s\S]*Usa Expirar/);
  assert.match(migration, /revoke all on function public\.block49_queue_pending_expiration_notification\(\)[\s\S]*from public, anon, authenticated/);
  assert.match(sqlRunner, /platform_pending_reservation_expiration\.sql/);
});
