import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025150000_block46_customer_change_request_expiration.sql", "utf8");
const actions = readFileSync("app/admin/(protected)/actions.ts", "utf8");
const operations = readFileSync("lib/admin/operations.ts", "utf8");
const adminUi = readFileSync("components/admin/AdminReservationChangeRequests.tsx", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const cancellationUi = readFileSync("components/account/CustomerReservationCancellationRequest.tsx", "utf8");
const rescheduleUi = readFileSync("components/account/CustomerReservationRescheduleRequest.tsx", "utf8");
const notifications = readFileSync("lib/notifications.ts", "utf8");
const audit = readFileSync("lib/admin/reservationAudit.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function functionBody(name: string) {
  return migration.match(new RegExp("create or replace function public\\." + name + "[\\s\\S]*?\\$\\$;", "i"))?.[0] ?? "";
}

test("B46 añade expiración semántica customer-origin sin crear status nuevo", () => {
  assert.match(migration, /resolution_kind = 'customer_expiration'/);
  assert.match(migration, /initiator_kind = 'customer'[\s\S]*status = 'rejected'[\s\S]*resolution_kind = 'customer_expiration'/);
  assert.doesNotMatch(migration, /status in \([^)]*expired/i);
});

test("B46 expire admin deriva tenant y bloquea reservation antes del request", () => {
  const fn = functionBody("admin_expire_customer_change_request");
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q", fn.indexOf("for update"));
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /v_actor\.role not in \('owner','admin'\)/);
  assert.match(fn, /q\.business_id = v_actor\.business_id/);
  assert.match(fn, /q\.initiator_kind = 'customer'/);
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /for update/);
  assert.doesNotMatch(fn, /update public\.reservations/i);
});

test("B46 solo expira cuando el request ya no puede resolverse temporalmente", () => {
  const fn = functionBody("admin_expire_customer_change_request");
  assert.match(fn, /v_reservation\.status = 'confirmed'/);
  assert.match(fn, /v_reservation\.start_at > now\(\)/);
  assert.match(fn, /v_request\.request_type = 'reschedule'/);
  assert.match(fn, /v_request\.requested_start_at is null or v_request\.requested_start_at <= now\(\)/);
  assert.match(fn, /customer_change_request_not_expired/);
  assert.match(fn, /v_request\.status = 'rejected' and v_request\.resolution_kind = 'customer_expiration'/);
});

test("B46 resolución normal no confunde expiración con rechazo idempotente", () => {
  const fn = functionBody("admin_resolve_reservation_change_request");
  assert.match(fn, /v_request\.resolution_kind = 'admin_resolution'/);
  assert.match(fn, /customer_change_request_expired_requires_expiration/);
  assert.match(fn, /v_reservation\.start_at <= now\(\)/);
  assert.match(fn, /v_request\.requested_start_at is null or v_request\.requested_start_at <= now\(\)/);
  assert.match(fn, /resolution_kind = 'admin_resolution'/);
});

test("B46 expone resolution_kind y Mi cuenta muestra expirado, no rechazado", () => {
  assert.match(migration, /q\.proposal_note, q\.resolution_kind/);
  assert.match(types, /resolution_kind: string \| null/);
  assert.match(account, /resolutionKind=\{cancellationRequest\?\.resolution_kind \?\? null\}/);
  assert.match(account, /resolutionKind=\{rescheduleRequest\?\.resolution_kind \?\? null\}/);
  assert.match(cancellationUi, /resolutionKind === "customer_expiration"/);
  assert.match(cancellationUi, /expiró sin modificar tu reserva/);
  assert.match(rescheduleUi, /resolutionKind === "customer_expiration"/);
  assert.match(rescheduleUi, /expiró sin modificar tu reserva/);
});

test("B46 UI admin cambia resolver por Expirar solicitud cuando ya venció", () => {
  assert.match(operations, /"expire_customer_change_request"/);
  assert.match(actions, /admin_expire_customer_change_request/);
  assert.match(actions, /customer_change_request_expired_requires_expiration/);
  assert.match(adminUi, /expireCustomerChangeRequestAction/);
  assert.match(adminUi, /customerRequestExpired/);
  assert.match(adminUi, /Expirar solicitud/);
});

test("B46 integra notificaciones auditoría tipos y runner SQL", () => {
  for (const source of [migration, notifications, audit, types]) {
    assert.match(source, /cancellation_expired/);
    assert.match(source, /reschedule_expired/);
  }
  assert.match(migration, /admin_expire_customer_change_request/);
  assert.match(types, /admin_expire_customer_change_request/);
  assert.match(sqlRunner, /platform_customer_change_request_expiration\.sql/);
});
