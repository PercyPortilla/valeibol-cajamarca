import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LocalAdminReservationRepository } from "../lib/data/repositories/localAdminReservationRepository.ts";
import { getLocalAdminState, resetLocalAdminStateForTests } from "../lib/data/localAdminStore.ts";

const migration = readFileSync("supabase/migrations/20261025173000_block51_admin_reservation_pagination.sql", "utf8");
const page = readFileSync("app/admin/(protected)/reservas/page.tsx", "utf8");
const repository = readFileSync("lib/data/repositories/supabaseAdminReservationRepository.ts", "utf8");
const repositoryContract = readFileSync("lib/data/repositories/adminReservationRepository.ts", "utf8");
const databaseTypes = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B51 filtra cada vista dentro del tenant antes del LIMIT", () => {
  const fn = migration.match(/create or replace function public\.get_admin_reservations_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /r\.business_id = v_actor\.business_id/);
  assert.match(fn, /v_view = 'active'[\s\S]*status in \('pending', 'confirmed'\)/);
  assert.match(fn, /v_view = 'completed'[\s\S]*status = 'completed'/);
  assert.match(fn, /v_view = 'cancelled'[\s\S]*status = 'cancelled'/);
  assert.match(fn, /v_view = 'archived'[\s\S]*archived_at is not null/);
  assert.ok(fn.indexOf("v_view = 'active'") < fn.indexOf("limit v_limit"));
});

test("B51 usa cursor keyset estable y desempata por id", () => {
  const fn = migration.match(/create or replace function public\.get_admin_reservations_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /num_nonnulls\(p_cursor_start_at, p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /invalid_reservation_cursor/);
  assert.match(fn, /invalid_reservation_view/);
  assert.match(fn, /greatest\(1, least\(coalesce\(p_limit, 41\), 101\)\)/);
  assert.match(fn, /\(r\.start_at, r\.created_at, r\.id\) < \(p_cursor_start_at, p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /order by r\.start_at desc, r\.created_at desc, r\.id desc/);
});

test("B51 no acepta business_id desde navegador y conserva scope global seleccionado", () => {
  assert.doesNotMatch(migration, /p_business_id/);
  assert.match(migration, /phase6_admin_actor\(\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public, pg_temp/);
  assert.match(migration, /revoke all on function public\.get_admin_reservations_page[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_admin_reservations_page[\s\S]*to authenticated/);
});

test("B51 repositorio expone página tipada y sobrelectura mínima para nextCursor", () => {
  assert.match(repositoryContract, /listPage\(options:/);
  assert.match(repository, /rpc\("get_admin_reservations_page"/);
  assert.match(repository, /p_limit: limit \+ 1/);
  assert.match(repository, /mapped\.length > limit/);
  assert.match(databaseTypes, /get_admin_reservations_page:/);
});

test("B51 UI deja de filtrar después de list\(200\) y navega por cursor", () => {
  assert.doesNotMatch(page, /\.list\(200,/);
  assert.match(page, /\.listPage\(\{/);
  assert.match(page, /view,[\s\S]*limit: 40,[\s\S]*cursor/);
  assert.match(page, /Ver más antiguas/);
  assert.match(page, /Volver al inicio/);
});

test("B51 paridad local evita starvation con más de 200 reservas de otras vistas", async () => {
  resetLocalAdminStateForTests();
  const state = getLocalAdminState();
  const template = state.reservations[0]!;
  state.reservations = [];

  for (let i = 0; i < 205; i += 1) {
    const stamp = new Date(Date.UTC(2027, 0, 1, 0, i)).toISOString();
    state.reservations.push({
      ...template,
      id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      status: "confirmed",
      startAt: stamp,
      createdAt: stamp,
      archivedAt: null,
    });
  }

  for (let i = 0; i < 3; i += 1) {
    const stamp = new Date(Date.UTC(2025, 0, 1, i)).toISOString();
    state.reservations.push({
      ...template,
      id: `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      status: "completed",
      startAt: stamp,
      createdAt: stamp,
      archivedAt: null,
    });
  }

  for (let i = 0; i < 3; i += 1) {
    const stamp = new Date(Date.UTC(2024, 0, 1, i)).toISOString();
    state.reservations.push({
      ...template,
      id: `30000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      status: "cancelled",
      startAt: stamp,
      createdAt: stamp,
      archivedAt: stamp,
    });
  }

  const local = new LocalAdminReservationRepository();
  const completed = await local.listPage({ view: "completed", limit: 2 });
  assert.equal(completed.items.length, 2);
  assert.ok(completed.items.every((item) => item.status === "completed" && item.archivedAt === null));
  assert.ok(completed.nextCursor);

  const completed2 = await local.listPage({ view: "completed", limit: 2, cursor: completed.nextCursor });
  assert.equal(completed2.items.length, 1);
  assert.equal(new Set([...completed.items, ...completed2.items].map((item) => item.id)).size, 3);

  const archived = await local.listPage({ view: "archived", limit: 2 });
  assert.equal(archived.items.length, 2);
  assert.ok(archived.items.every((item) => item.archivedAt !== null));
});

test("B51 registra contrato SQL en el runner", () => {
  assert.match(runner, /platform_admin_reservation_pagination\.sql/);
});
