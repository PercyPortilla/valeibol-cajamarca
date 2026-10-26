import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025170000_block50_public_pending_immutability.sql", "utf8");
const scheduleBoard = readFileSync("components/admin/AdminScheduleBoard.tsx", "utf8");
const localRepository = readFileSync("lib/data/repositories/localAdminOperationsRepository.ts", "utf8");
const supabaseRepository = readFileSync("lib/data/repositories/supabaseAdminOperationsRepository.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function editFunction() {
  return migration.match(/create or replace function public\.admin_edit_reservation[\s\S]*?\$\$;/i)?.[0] ?? "";
}

test("B50 hace inmutable una PENDING public_web antes de cualquier mutación", () => {
  const fn = editFunction();
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /r\.business_id = v_actor\.business_id[\s\S]*for update/);
  assert.match(fn, /v_reservation\.source = 'public_web'[\s\S]*public_pending_request_not_editable/);
  assert.ok(fn.indexOf("public_pending_request_not_editable") < fn.indexOf("update public.reservations"));
});

test("B50 conserva semántica B40 y B49 antes del guard public_web", () => {
  const fn = editFunction();
  const confirmed = fn.indexOf("confirmed_reschedule_requires_request");
  const stale = fn.indexOf("pending_reservation_expired_requires_expiration");
  const publicGuard = fn.indexOf("public_pending_request_not_editable");
  assert.ok(confirmed >= 0 && stale > confirmed && publicGuard > stale);
});

test("B50 no bloquea indiscriminadamente PENDING internas", () => {
  const fn = editFunction();
  assert.match(fn, /if v_reservation\.source = 'public_web' then/);
  assert.doesNotMatch(fn, /source (?:<>|!=) 'public_web'[\s\S]*raise exception 'reservation_not_editable'/);
  assert.match(fn, /update public\.reservations/);
});

test("B50 pizarra oculta Editar para public_web pero conserva decisiones de lifecycle", () => {
  assert.match(scheduleBoard, /entry\.status === "pending" && entry\.source !== "public_web"[\s\S]*edit_reservation/);
  assert.match(scheduleBoard, /entry\.status === "pending"[\s\S]*confirm_reservation/);
  assert.match(scheduleBoard, /entry\.status === "pending"[\s\S]*reject_reservation/);
  assert.match(scheduleBoard, /expirePendingReservationAction/);
});

test("B50 paridad local bloquea public_web después de respetar expiración", () => {
  const stale = localRepository.indexOf("La solicitud ya venció. Usa Expirar.");
  const publicGuard = localRepository.indexOf("Las solicitudes creadas por clientes desde la web no pueden editarse.");
  assert.ok(stale >= 0 && publicGuard > stale);
  assert.match(localRepository, /reservation\.source === "public_web"/);
});

test("B50 feedback Supabase explica la operación correcta", () => {
  assert.match(supabaseRepository, /public_pending_request_not_editable/);
  assert.match(supabaseRepository, /Confirma, rechaza o expira la solicitud/);
});

test("B50 no añade eventos falsos de notificación o auditoría", () => {
  assert.doesNotMatch(migration, /app_notifications/);
  assert.doesNotMatch(migration, /reservation_audit_events/);
  assert.doesNotMatch(migration, /reservation_(?:details_updated|rescheduled)/);
});

test("B50 mantiene una única firma real y privilegios encapsulados", () => {
  assert.match(migration, /p_net_height_cm smallint/);
  assert.match(migration, /revoke all on function public\.admin_edit_reservation\([\s\S]*smallint[\s\S]*\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_edit_reservation\([\s\S]*smallint[\s\S]*\) to authenticated/);
});

test("B50 registra contrato SQL en el runner", () => {
  assert.match(runner, /platform_public_pending_immutability\.sql/);
});
