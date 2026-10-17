import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/202610160003_reservation_archiving.sql";

test("migración archiva sin borrar y permite restauración solo owner/admin", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /add column if not exists archived_at timestamptz/i);
  assert.match(sql, /admin_archive_cancelled_reservation\(p_reservation_id uuid\)/i);
  assert.match(sql, /admin_restore_archived_reservation\(p_reservation_id uuid\)/i);
  assert.match(sql, /v_actor\.role not in \('owner', 'admin'\)/i);
  assert.match(sql, /r\.business_id = v_actor\.business_id/i);
  assert.match(sql, /v_reservation\.status <> 'cancelled'/i);
  assert.match(sql, /set archived_at = now\(\)/i);
  assert.match(sql, /set archived_at = null/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.reservations/i);
});

test("historial oculta archivadas por defecto y permite incluirlas explícitamente", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const dropLegacy = sql.search(/drop function if exists public\.get_admin_reservation_requests\(integer\)/i);
  const recreateLegacy = sql.search(/create or replace function public\.get_admin_reservation_requests\(p_limit integer default 100\)/i);

  assert.match(sql, /get_admin_reservation_requests\(\s*p_limit integer,\s*p_include_archived boolean/i);
  assert.match(sql, /drop function if exists public\.get_admin_reservation_requests\(integer\)/i);
  assert.ok(dropLegacy >= 0 && recreateLegacy >= 0 && dropLegacy < recreateLegacy, "la firma histórica debe eliminarse antes de recrearse con el nuevo RETURNS TABLE");
  assert.match(sql, /coalesce\(p_include_archived, false\) or r\.archived_at is null/i);
  assert.match(sql, /get_admin_reservation_requests\(p_limit, false\)/i);
  assert.match(sql, /grant execute on function public\.admin_archive_cancelled_reservation\(uuid\) to authenticated/i);
  assert.match(sql, /grant execute on function public\.admin_restore_archived_reservation\(uuid\) to authenticated/i);
});
