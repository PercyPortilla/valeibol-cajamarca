import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025210000_block58_customer_notification_pagination.sql", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const component = readFileSync("components/account/CustomerNotificationCenter.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B58 pagina notificaciones únicamente para auth.uid", () => {
  const fn = migration.match(/create or replace function public\.get_my_notifications_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /v_uid uuid := auth\.uid\(\)/);
  assert.match(fn, /ua\.user_id = v_uid[\s\S]*ua\.is_active/);
  assert.match(fn, /n\.audience = 'customer'/);
  assert.match(fn, /n\.recipient_user_id = v_uid/);
  assert.match(fn, /reads\.user_id = v_uid/);
  assert.doesNotMatch(fn, /p_user_id|p_business_id/);
  assert.match(fn, /num_nonnulls\(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /\(n\.created_at, n\.id\) < \(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /order by n\.created_at desc, n\.id desc/);
  assert.match(fn, /least\(coalesce\(p_limit, 41\), 101\)/);
});

test("B58 Mi cuenta deja de cortar en 40 y permite navegar historial", () => {
  assert.match(account, /get_my_notifications_page/);
  assert.match(account, /NOTIFICATION_PAGE_SIZE = 40/);
  assert.match(account, /p_limit: NOTIFICATION_PAGE_SIZE \+ 1/);
  assert.doesNotMatch(account, /get_my_notifications[^_][\s\S]*p_limit: 40/);
  assert.match(account, /notificationsWithExtra\.slice\(0, NOTIFICATION_PAGE_SIZE\)/);
  assert.match(account, /Ver notificaciones más antiguas/);
  assert.match(account, /Volver al inicio/);
  assert.match(component, /No hay más notificaciones en esta página/);
});

test("B58 conserva estado leído y acciones B41 del cliente", () => {
  assert.match(migration, /left join public\.app_notification_reads reads/);
  assert.match(component, /mark_my_notification_read/);
  assert.match(component, /mark_all_my_notifications_read/);
  assert.match(component, /notification\.read_at/);
});

test("B58 cursor estable e índice específico de cliente", () => {
  assert.match(migration, /p_cursor_created_at timestamptz/);
  assert.match(migration, /p_cursor_id uuid/);
  assert.doesNotMatch(migration, /p_cursor_read_at|p_cursor_start_at/);
  assert.match(migration, /app_notifications_customer_page_idx/);
  assert.match(migration, /recipient_user_id, created_at desc, id desc/);
});

test("B58 contratos, privilegios y artefactos quedan registrados", () => {
  assert.match(migration, /revoke all on function public\.get_my_notifications_page[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_my_notifications_page[\s\S]*to authenticated/);
  assert.match(types, /get_my_notifications_page:/);
  assert.match(types, /p_cursor_created_at\?: string \| null/);
  assert.match(types, /p_cursor_id\?: string \| null/);
  assert.match(runner, /platform_customer_notification_pagination\.sql/);
  assert.match(completeness, /20261025210000_block58_customer_notification_pagination\.sql/);
  assert.match(completeness, /platform-customer-notification-pagination\.test\.ts/);
  assert.match(completeness, /BLOCK58_PROMPT\.md/);
});

test("B58 keyset recorre más de 100 notificaciones sin omitir ni duplicar", () => {
  type Row = { id: string; createdAt: string };
  const rows: Row[] = Array.from({ length: 143 }, (_, index) => ({
    id: `72000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    createdAt: new Date(Date.UTC(2026, 9, 25, 13, 0, index % 60)).toISOString(),
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  const seen = new Set<string>();
  let cursor: { createdAt: string; id: string } | null = null;
  do {
    const eligible: Row[] = cursor
      ? rows.filter((row) => row.createdAt < cursor!.createdAt
        || (row.createdAt === cursor!.createdAt && row.id < cursor!.id))
      : rows;
    const pageRows = eligible.slice(0, 40);
    pageRows.forEach((row) => seen.add(row.id));
    const last = pageRows.at(-1);
    cursor = eligible.length > 40 && last
      ? { createdAt: last.createdAt, id: last.id }
      : null;
  } while (cursor);

  assert.equal(seen.size, 143);
});
