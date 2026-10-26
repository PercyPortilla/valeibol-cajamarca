import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025183000_block53_complete_admin_export.sql", "utf8");
const route = readFileSync("app/api/admin/export.xlsx/route.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B53 export paginado conserva tenant, rol y rango autoritativos", () => {
  const fn = migration.match(/create or replace function public\.get_admin_export_reservations_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /v_actor\.role not in \('owner', 'admin'\)/);
  assert.match(fn, /r\.business_id = v_actor\.business_id/);
  assert.match(fn, /at time zone v_actor\.timezone/);
  assert.doesNotMatch(fn, /p_business_id|p_user_id/i);
});

test("B53 usa keyset created_at+id y cada página queda por debajo del max_rows", () => {
  const fn = migration.match(/create or replace function public\.get_admin_export_reservations_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /num_nonnulls\(p_cursor_created_at, p_cursor_id\) not in \(0, 2\)/);
  assert.match(fn, /\(r\.created_at, r\.id\) > \(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /order by r\.created_at asc, r\.id asc/);
  assert.match(fn, /least\(coalesce\(p_limit, 500\), 500\)/);
  assert.match(fn, /num_nonnulls\(p_snapshot_created_at, p_snapshot_id\) not in \(0, 2\)/);
  assert.match(fn, /order by r\.created_at desc, r\.id desc[\s\S]*limit 1/);
  assert.match(fn, /\(r\.created_at, r\.id\) <= \(v_snapshot_created_at, v_snapshot_id\)/);
});

test("B53 producción acumula todas las páginas y ya no usa una RPC única truncable", () => {
  assert.match(route, /loadAllProductionReservations/);
  assert.match(route, /batchSize = 500/);
  assert.match(route, /get_admin_export_reservations_page/);
  assert.match(route, /rows\.push\(\.\.\.batch\)/);
  assert.match(route, /cursorCreatedAt = last\.created_at/);
  assert.match(route, /cursorId = last\.reservation_id/);
  assert.match(route, /snapshotCreatedAt = batch\[0\]\.export_snapshot_created_at/);
  assert.match(route, /p_snapshot_created_at: snapshotCreatedAt/);
  assert.doesNotMatch(route, /client\.rpc\("get_admin_export_reservations", \{ p_from: from, p_to: to \}\)/);
});

test("B53 local recorre las cuatro vistas B51 sin list(200,true)", () => {
  assert.match(route, /\["active", "completed", "cancelled", "archived"\] as const/);
  assert.match(route, /reservationsRepo\.listPage\(\{ view, limit: 100, cursor \}\)/);
  assert.match(route, /while \(cursor\)/);
  assert.doesNotMatch(route, /reservationsRepo\.list\(200, true\)/);
});

test("B53 reordena el XLSX por horario sin usar OFFSET para paginar", () => {
  assert.match(route, /compareExportReservations/);
  assert.match(route, /startAt\.localeCompare\(b\.startAt\)/);
  assert.doesNotMatch(migration, /offset\s+/i);
});

test("B53 sincroniza tipos, privilegios y runner SQL", () => {
  assert.match(types, /get_admin_export_reservations_page/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.match(migration, /revoke all on function public\.get_admin_export_reservations_page[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_admin_export_reservations_page[\s\S]*to authenticated/);
  assert.match(runner, /platform_admin_export_completeness\.sql/);
});
