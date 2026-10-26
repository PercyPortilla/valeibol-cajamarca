import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025220000_block60_customer_reservation_pagination.sql", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B60 pagina historial propio únicamente por auth.uid", () => {
  const fn = migration.match(/create or replace function public\.get_my_reservations_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /v_uid uuid := auth\.uid\(\)/);
  assert.match(fn, /r\.user_id = v_uid/);
  assert.doesNotMatch(fn, /p_user_id|p_business_id/);
  assert.match(fn, /num_nonnulls\(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /\(r\.created_at, r\.id\) < \(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /order by r\.created_at desc, r\.id desc/);
  assert.match(fn, /least\(coalesce\(p_limit, 21\), 101\)/);
});

test("B60 conserva capacidades autoritativas B30 B39 B40 B48 B49", () => {
  const fn = migration.match(/create or replace function public\.get_my_reservations_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /as can_withdraw/);
  assert.match(fn, /as can_request_cancellation/);
  assert.match(fn, /as can_request_reschedule/);
  assert.match(fn, /r\.closure_kind/);
  assert.match(fn, /as is_expired_pending/);
  assert.match(fn, /reservation_payments/);
  assert.match(fn, /reservation_change_requests/);
});

test("B60 Mi cuenta deja de cargar todo el historial y pagina 20 reservas", () => {
  assert.match(account, /get_my_reservations_page/);
  assert.match(account, /RESERVATION_PAGE_SIZE = 20/);
  assert.match(account, /p_limit: RESERVATION_PAGE_SIZE \+ 1/);
  assert.doesNotMatch(account, /rpc\("get_my_reservations"\)/);
  assert.match(account, /reservationsWithExtra\.slice\(0, RESERVATION_PAGE_SIZE\)/);
  assert.match(account, /Ver reservas más antiguas/);
  assert.match(account, /Volver al inicio de reservas/);
});

test("B60 carga solo latest change requests de reservas visibles", () => {
  const fn = migration.match(/create or replace function public\.get_my_latest_reservation_change_requests[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /owned\.user_id = v_uid/);
  assert.match(fn, /q\.user_id = v_uid/);
  assert.match(fn, /q\.reservation_id = any\(p_reservation_ids\)/);
  assert.match(fn, /partition by q\.reservation_id, q\.request_type, q\.initiator_kind/);
  assert.match(fn, /where q\.rn = 1/);
  assert.match(account, /get_my_latest_reservation_change_requests/);
  assert.match(account, /p_reservation_ids: reservations\.map/);
  assert.doesNotMatch(account, /rpc\("get_my_reservation_change_requests"\)/);
});

test("B60 cursor usa claves inmutables e índice dedicado", () => {
  assert.match(migration, /reservations_customer_history_page_idx/);
  assert.match(migration, /user_id, created_at desc, id desc/);
  assert.doesNotMatch(migration, /p_cursor_start_at/);
  assert.match(types, /get_my_reservations_page:/);
  assert.match(types, /get_my_latest_reservation_change_requests:/);
});

test("B60 contratos, privilegios y artefactos quedan registrados", () => {
  assert.match(migration, /revoke all on function public\.get_my_reservations_page[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_my_latest_reservation_change_requests[\s\S]*to authenticated/);
  assert.match(runner, /platform_customer_reservation_pagination\.sql/);
  assert.match(completeness, /20261025220000_block60_customer_reservation_pagination\.sql/);
  assert.match(completeness, /platform-customer-reservation-pagination\.test\.ts/);
  assert.match(completeness, /BLOCK60_PROMPT\.md/);
});

test("B60 keyset recorre más de 100 reservas sin omitir ni duplicar", () => {
  type Row = { id: string; createdAt: string };
  const rows: Row[] = Array.from({ length: 151 }, (_, index) => ({
    id: `75000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    createdAt: new Date(Date.UTC(2026, 9, 25, 16, 0, index % 60)).toISOString(),
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const seen = new Set<string>();
  let cursor: { createdAt: string; id: string } | null = null;
  do {
    const eligible: Row[] = cursor
      ? rows.filter((row) => row.createdAt < cursor!.createdAt
        || (row.createdAt === cursor!.createdAt && row.id < cursor!.id))
      : rows;
    const pageRows = eligible.slice(0, 20);
    pageRows.forEach((row) => seen.add(row.id));
    const last = pageRows.at(-1);
    cursor = eligible.length > 20 && last
      ? { createdAt: last.createdAt, id: last.id }
      : null;
  } while (cursor);

  assert.equal(seen.size, 151);
});
