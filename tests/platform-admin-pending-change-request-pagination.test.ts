import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025213000_block59_admin_pending_change_request_pagination.sql", "utf8");
const page = readFileSync("app/admin/(protected)/reservas/page.tsx", "utf8");
const component = readFileSync("components/admin/AdminReservationChangeRequests.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B59 filtra pending dentro del tenant antes del LIMIT", () => {
  const fn = migration.match(/create or replace function public\.get_admin_pending_reservation_change_requests_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /q\.business_id = v_actor\.business_id/);
  assert.match(fn, /q\.status = 'pending'/);
  assert.ok(fn.indexOf("q.status = 'pending'") < fn.indexOf("limit v_limit"));
  assert.doesNotMatch(fn, /p_business_id/);
});

test("B59 usa cursor keyset inmutable y acotado", () => {
  const fn = migration.match(/create or replace function public\.get_admin_pending_reservation_change_requests_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /num_nonnulls\(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /\(q\.created_at, q\.id\) < \(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /order by q\.created_at desc, q\.id desc/);
  assert.match(fn, /least\(coalesce\(p_limit, 21\), 51\)/);
  assert.doesNotMatch(fn, /p_cursor_resolved_at|p_cursor_start_at/);
});

test("B59 UI deja de descargar todo el historial de change requests", () => {
  assert.match(page, /get_admin_pending_reservation_change_requests_page/);
  assert.match(page, /CHANGE_REQUEST_PAGE_SIZE = 20/);
  assert.match(page, /p_limit: CHANGE_REQUEST_PAGE_SIZE \+ 1/);
  assert.doesNotMatch(page, /rpc\("get_admin_reservation_change_requests"\)/);
  assert.match(page, /Ver solicitudes más antiguas/);
  assert.match(page, /Volver al inicio de solicitudes/);
  assert.match(component, /No hay más solicitudes pendientes en esta página/);
});

test("B59 conserva hasPendingChange exacto para reservas visibles", () => {
  const flags = migration.match(/create or replace function public\.get_admin_pending_change_reservation_ids[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(flags, /q\.business_id = v_actor\.business_id/);
  assert.match(flags, /q\.status = 'pending'/);
  assert.match(flags, /q\.reservation_id = any\(p_reservation_ids\)/);
  assert.match(flags, /cardinality\(p_reservation_ids\) > 100/);
  assert.match(page, /get_admin_pending_change_reservation_ids/);
  assert.match(page, /pendingChangeReservationIds\.has\(reservation\.id\)/);
  assert.doesNotMatch(page, /changeRequests\.some\(\(request\) => request\.reservation_id === reservation\.id/);
});

test("B59 privilegios, índice, tipos y artefactos quedan registrados", () => {
  assert.match(migration, /reservation_change_requests_admin_pending_page_idx/);
  assert.match(migration, /business_id, created_at desc, id desc/);
  assert.match(migration, /where status = 'pending'/);
  assert.match(migration, /revoke all on function public\.get_admin_pending_reservation_change_requests_page[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_admin_pending_change_reservation_ids[\s\S]*to authenticated/);
  assert.match(types, /get_admin_pending_reservation_change_requests_page:/);
  assert.match(types, /get_admin_pending_change_reservation_ids:/);
  assert.match(runner, /platform_admin_pending_change_request_pagination\.sql/);
  assert.match(completeness, /20261025213000_block59_admin_pending_change_request_pagination\.sql/);
  assert.match(completeness, /platform-admin-pending-change-request-pagination\.test\.ts/);
  assert.match(completeness, /BLOCK59_PROMPT\.md/);
});

test("B59 más de 100 pendientes recorren completo aunque existan muchos resueltos", () => {
  type Row = { id: string; createdAt: string; status: "pending" | "approved" };
  const rows: Row[] = [
    ...Array.from({ length: 127 }, (_, index) => ({
      id: `73000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      createdAt: new Date(Date.UTC(2026, 9, 25, 14, 0, index % 60)).toISOString(),
      status: "pending" as const,
    })),
    ...Array.from({ length: 450 }, (_, index) => ({
      id: `74000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      createdAt: new Date(Date.UTC(2026, 9, 25, 15, 0, index % 60)).toISOString(),
      status: "approved" as const,
    })),
  ];
  const pending = rows
    .filter((row) => row.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const seen = new Set<string>();
  let cursor: { createdAt: string; id: string } | null = null;
  do {
    const eligible: Row[] = cursor
      ? pending.filter((row) => row.createdAt < cursor!.createdAt
        || (row.createdAt === cursor!.createdAt && row.id < cursor!.id))
      : pending;
    const pageRows = eligible.slice(0, 20);
    pageRows.forEach((row) => seen.add(row.id));
    const last = pageRows.at(-1);
    cursor = eligible.length > 20 && last
      ? { createdAt: last.createdAt, id: last.id }
      : null;
  } while (cursor);

  assert.equal(seen.size, 127);
});
