import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025120000_block42_reservation_audit.sql", "utf8");
const reservationsPage = readFileSync("app/admin/(protected)/reservas/page.tsx", "utf8");
const auditPage = readFileSync("app/admin/(protected)/reservas/[id]/historial/page.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B42 crea un log privado sin duplicar PII", () => {
  const table = migration.match(/create table if not exists public\.reservation_audit_events[\s\S]*?\);/i)?.[0] ?? "";
  assert.match(table, /reservation_id uuid not null/);
  assert.match(table, /event_sequence bigint generated always as identity unique/);
  assert.match(table, /transaction_id text not null default pg_current_xact_id\(\)::text/);
  assert.match(table, /actor_kind text not null/);
  assert.match(table, /old_start_at timestamptz/);
  assert.match(table, /new_start_at timestamptz/);
  assert.doesNotMatch(table, /full_name|phone|email|customer_reason|internal_note/i);
  assert.match(migration, /revoke all on public\.reservation_audit_events from public, anon, authenticated/i);
  assert.match(migration, /before update or delete on public\.reservation_audit_events/i);
  assert.match(migration, /reservation_audit_is_append_only/);
  assert.match(migration, /revoke all on function public\.block42_reject_audit_mutation\(\) from public, anon, authenticated/i);
  assert.match(migration, /references public\.businesses\(id\) on delete cascade/i);
  assert.match(migration, /references public\.reservations\(id, business_id\) on delete cascade/i);
  assert.match(migration, /references public\.reservation_change_requests\(id, business_id\) on delete cascade/i);
  assert.match(migration, /tg_op = 'DELETE' and not exists[\s\S]*?from public\.businesses/i);
});

test("B42 audita lifecycle, horarios y vínculo de cuenta desde la fuente autoritativa", () => {
  const fn = migration.match(/create or replace function public\.block42_audit_reservation[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /reservation_created/);
  assert.match(fn, /when new\.source = 'public_web' then 'customer'/);
  assert.match(fn, /reservation_confirmed/);
  assert.match(fn, /reservation_cancelled/);
  assert.match(fn, /reservation_completed/);
  assert.match(fn, /reservation_rescheduled/);
  assert.match(fn, /reservation_details_updated/);
  assert.match(fn, /reservation_account_linked/);
  assert.match(fn, /reservation_customer_changed/);
  assert.match(fn, /reservation_archived/);
  assert.match(fn, /reservation_restored/);
  assert.match(migration, /after insert or update of status, court_id, start_at, end_at, lighting,[\s\S]*?customer_id, archived_at/i);
  assert.match(migration, /old_hourly_rate numeric/);
  assert.match(migration, /new_hourly_rate numeric/);
});

test("B42 audita solicitudes B39-B40 con actor categórico", () => {
  const fn = migration.match(/create or replace function public\.block42_audit_change_request[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /cancellation_requested/);
  assert.match(fn, /cancellation_approved/);
  assert.match(fn, /cancellation_rejected/);
  assert.match(fn, /reschedule_requested/);
  assert.match(fn, /reschedule_approved/);
  assert.match(fn, /reschedule_rejected/);
  assert.match(fn, /request_type, old_request_status, new_request_status/);
  assert.match(fn, /new\.request_type, old\.status, new\.status/);
  const resolutionBranch = fn.match(/if old\.status is distinct from new\.status[\s\S]*?end if;/i)?.[0] ?? "";
  assert.doesNotMatch(resolutionBranch, /v_reservation\.status|v_current_court_name|requested_start_at/i);
  assert.match(migration, /actor_kind in \('customer','owner','admin','staff','platform_admin','system'\)/i);
});

test("B42 prioriza rol administrativo sobre vínculo customer para clasificar actor", () => {
  const fn = migration.match(/create or replace function public\.block42_actor_kind[\s\S]*?\$\$;/i)?.[0] ?? "";
  const platformIndex = fn.indexOf("ua.role = 'admin'");
  const profileIndex = fn.indexOf("select p.role");
  const customerIndex = fn.indexOf("p_customer_user_id is not null");
  assert.ok(platformIndex >= 0 && profileIndex > platformIndex && customerIndex > profileIndex);
});

test("B42 lectura admin deriva tenant y no expone actor_user_id ni PII", () => {
  const fn = migration.match(/create or replace function public\.get_admin_reservation_audit[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /e\.business_id = v_actor\.business_id/);
  assert.match(fn, /Administrador global/);
  assert.doesNotMatch(fn, /email|phone|full_name/i);
  const returns = fn.match(/returns table \([\s\S]*?\)\s*language/i)?.[0] ?? "";
  assert.doesNotMatch(returns, /actor_user_id/i);
  assert.doesNotMatch(returns, /customer_id|archived_at/i);
  assert.match(returns, /request_type text/);
  assert.match(returns, /old_request_status text/);
  assert.match(returns, /new_request_status text/);
  assert.match(returns, /operation_id text/);
  assert.match(fn, /order by e\.created_at desc, e\.event_sequence desc/i);
});

test("B42 UI permite abrir historial y compara antes/después con moneda tenant", () => {
  assert.match(reservationsPage, /\/historial/);
  assert.match(reservationsPage, /Ver historial/);
  assert.match(auditPage, /get_admin_reservation_audit(?:_page)?/);
  assert.match(auditPage, /ANTES/);
  assert.match(auditPage, /DESPUÉS/);
  assert.match(auditPage, /event\.currency/);
  assert.match(auditPage, /Tarifa por hora/);
  assert.match(auditPage, /Misma operación/);
  assert.match(auditPage, /event\.operation_id/);
  assert.match(auditPage, /old_request_status/);
  assert.doesNotMatch(auditPage, /actor_user_id|customer_reason|phone_e164/i);
});

test("B42 sincroniza tipos y runner SQL", () => {
  assert.match(types, /get_admin_reservation_audit/);
  assert.match(types, /actor_label/);
  assert.match(sqlRunner, /platform_reservation_audit\.sql/);
});

