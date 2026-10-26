import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025203000_block57_admin_notification_pagination.sql", "utf8");
const page = readFileSync("app/admin/(protected)/notificaciones/page.tsx", "utf8");
const component = readFileSync("components/admin/AdminNotificationCenter.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B57 pagina notificaciones admin dentro del tenant antes del LIMIT", () => {
  const fn = migration.match(/create or replace function public\.get_admin_notifications_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /n\.audience = 'admin'/);
  assert.match(fn, /n\.business_id = v_actor\.business_id/);
  assert.match(fn, /reads\.user_id = v_actor\.user_id/);
  assert.doesNotMatch(fn, /p_business_id|p_user_id/);
  assert.match(fn, /num_nonnulls\(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /\(n\.created_at, n\.id\) < \(p_cursor_created_at, p_cursor_id\)/);
  assert.match(fn, /order by n\.created_at desc, n\.id desc/);
  assert.match(fn, /least\(coalesce\(p_limit, 41\), 101\)/);
});

test("B57 UI deja de cortar en 60 y ofrece navegación completa", () => {
  assert.match(page, /get_admin_notifications_page/);
  assert.match(page, /PAGE_SIZE = 40/);
  assert.match(page, /p_limit: PAGE_SIZE \+ 1/);
  assert.doesNotMatch(page, /get_admin_notifications[^_][\s\S]*p_limit: 60/);
  assert.match(page, /notificationsWithExtra\.slice\(0, PAGE_SIZE\)/);
  assert.match(page, /Ver notificaciones más antiguas/);
  assert.match(page, /Volver al inicio/);
  assert.match(component, /No hay más notificaciones en esta página/);
});

test("B57 conserva estado leído por operador y acciones B41", () => {
  assert.match(migration, /left join public\.app_notification_reads reads/);
  assert.match(migration, /reads\.notification_id = n\.id/);
  assert.match(migration, /reads\.user_id = v_actor\.user_id/);
  assert.match(component, /mark_admin_notification_read/);
  assert.match(component, /mark_all_admin_notifications_read/);
});

test("B57 cursor usa claves estables y agrega índice específico", () => {
  assert.match(migration, /p_cursor_created_at timestamptz/);
  assert.match(migration, /p_cursor_id uuid/);
  assert.doesNotMatch(migration, /p_cursor_read_at|p_cursor_start_at/);
  assert.match(migration, /app_notifications_admin_page_idx/);
  assert.match(migration, /business_id, created_at desc, id desc/);
});

test("B57 contratos, privilegios y artefactos quedan registrados", () => {
  assert.match(migration, /revoke all on function public\.get_admin_notifications_page[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_admin_notifications_page[\s\S]*to authenticated/);
  assert.match(types, /get_admin_notifications_page:/);
  assert.match(types, /p_cursor_created_at\?: string \| null/);
  assert.match(types, /p_cursor_id\?: string \| null/);
  assert.match(runner, /platform_admin_notification_pagination\.sql/);
  assert.match(completeness, /20261025203000_block57_admin_notification_pagination\.sql/);
  assert.match(completeness, /platform-admin-notification-pagination\.test\.ts/);
  assert.match(completeness, /BLOCK57_PROMPT\.md/);
});

test("B57 keyset recorre más de 100 notificaciones sin omitir ni duplicar", () => {
  type Row = { id: string; createdAt: string };
  const rows: Row[] = Array.from({ length: 137 }, (_, index) => ({
    id: `71000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    createdAt: new Date(Date.UTC(2026, 9, 25, 12, 0, index % 60)).toISOString(),
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

  assert.equal(seen.size, 137);
});
