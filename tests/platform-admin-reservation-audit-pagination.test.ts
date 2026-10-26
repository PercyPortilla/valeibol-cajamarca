import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025200000_block56_admin_reservation_audit_pagination.sql", "utf8");
const page = readFileSync("app/admin/(protected)/reservas/[id]/historial/page.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B56 pagina auditoría dentro del tenant antes del LIMIT", () => {
  const fn = migration.match(/create or replace function public\.get_admin_reservation_audit_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /r\.id = p_reservation_id[\s\S]*r\.business_id = v_actor\.business_id/);
  assert.match(fn, /e\.reservation_id = p_reservation_id[\s\S]*e\.business_id = v_actor\.business_id/);
  assert.doesNotMatch(fn, /p_business_id/);
  assert.match(fn, /num_nonnulls\(p_cursor_created_at, p_cursor_event_sequence\)/);
  assert.match(fn, /\(e\.created_at, e\.event_sequence\) < \(p_cursor_created_at, p_cursor_event_sequence\)/);
  assert.match(fn, /order by e\.created_at desc, e\.event_sequence desc/);
  assert.match(fn, /least\(coalesce\(p_limit, 51\), 101\)/);
});

test("B56 conserva resolution_note y no expone PII en la nueva RPC", () => {
  const fn = migration.match(/create or replace function public\.get_admin_reservation_audit_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /left join public\.reservation_change_requests q/);
  assert.match(fn, /q\.business_id = e\.business_id/);
  assert.match(fn, /q\.reservation_id = e\.reservation_id/);
  assert.match(fn, /q\.resolution_note/);
  const returns = fn.match(/returns table \([\s\S]*?\)\s*language/i)?.[0] ?? "";
  assert.match(returns, /event_sequence bigint/);
  assert.match(returns, /resolution_note text/);
  assert.doesNotMatch(returns, /actor_user_id|customer_id|phone|email|full_name/i);
});

test("B56 UI elimina el corte fijo de 150 y ofrece navegación completa", () => {
  assert.match(page, /get_admin_reservation_audit_page/);
  assert.match(page, /p_limit: PAGE_SIZE \+ 1/);
  assert.doesNotMatch(page, /get_admin_reservation_audit[^_][\s\S]*p_limit: 150/);
  assert.match(page, /PAGE_SIZE = 50/);
  assert.match(page, /eventsWithExtra\.slice\(0, PAGE_SIZE\)/);
  assert.match(page, /Ver eventos más antiguos/);
  assert.match(page, /Volver al inicio del historial/);
  assert.match(page, /No hay más eventos en esta página/);
});

test("B56 cursor usa únicamente claves inmutables del ledger append-only", () => {
  assert.match(migration, /p_cursor_created_at timestamptz/);
  assert.match(migration, /p_cursor_event_sequence bigint/);
  assert.doesNotMatch(migration, /p_cursor_updated_at|p_cursor_start_at/);
  assert.match(migration, /reservation_audit_events_business_reservation_page_idx/);
  assert.match(migration, /created_at desc,[\s\S]*event_sequence desc/);
});

test("B56 contratos, privilegios y artefactos quedan registrados", () => {
  assert.match(migration, /revoke all on function public\.get_admin_reservation_audit_page[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_admin_reservation_audit_page[\s\S]*to authenticated/);
  assert.match(types, /get_admin_reservation_audit_page:/);
  assert.match(types, /p_cursor_event_sequence\?: number/);
  assert.match(types, /event_sequence: number/);
  assert.match(runner, /platform_admin_reservation_audit_pagination\.sql/);
  assert.match(completeness, /20261025200000_block56_admin_reservation_audit_pagination\.sql/);
  assert.match(completeness, /platform-admin-reservation-audit-pagination\.test\.ts/);
  assert.match(completeness, /BLOCK56_PROMPT\.md/);
});

test("B56 keyset puede recorrer más de 200 eventos sin omitir ni duplicar", () => {
  type AuditRow = { id: number; createdAt: string; eventSequence: number };
  const rows: AuditRow[] = Array.from({ length: 235 }, (_, index) => ({
    id: index + 1,
    createdAt: new Date(Date.UTC(2026, 9, 25, 12, 0, index % 60)).toISOString(),
    eventSequence: index + 1,
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.eventSequence - a.eventSequence);

  const seen = new Set<number>();
  let cursor: { createdAt: string; eventSequence: number } | null = null;
  do {
    const eligible: AuditRow[] = cursor
      ? rows.filter((row) => row.createdAt < cursor!.createdAt
        || (row.createdAt === cursor!.createdAt && row.eventSequence < cursor!.eventSequence))
      : rows;
    const pageRows = eligible.slice(0, 50);
    pageRows.forEach((row) => seen.add(row.id));
    const last = pageRows.at(-1);
    cursor = eligible.length > 50 && last
      ? { createdAt: last.createdAt, eventSequence: last.eventSequence }
      : null;
  } while (cursor);

  assert.equal(seen.size, 235);
});
