import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261023091203_customer_accounts_history.sql", "utf8");
const route = readFileSync("app/api/public/reservation-requests/route.ts", "utf8");
const edge = readFileSync("supabase/functions/public-reservation-request/index.ts", "utf8");

test("historial cliente deriva identidad exclusivamente desde auth.uid", () => {
  const history = migration.match(/create or replace function public\.get_my_reservations\(\)[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(history, /auth\.uid\(\)/i);
  assert.doesNotMatch(history, /p_user_id/i);
  assert.match(migration, /grant execute on function public\.get_my_reservations\(\) to authenticated/i);
  assert.match(migration, /revoke all on function public\.get_my_reservations\(\) from public, anon/i);
});

test("vínculo reservation→user es server-only", () => {
  assert.match(migration, /link_public_reservation_user\(uuid,uuid\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.link_public_reservation_user\(uuid,uuid\)[\s\S]*to service_role/i);
});

test("navegador no puede inyectar authenticatedUserId", () => {
  const allowedBlock = route.match(/const ALLOWED_KEYS = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? "";
  assert.doesNotMatch(allowedBlock, /authenticatedUserId/);
  assert.match(route, /authenticatedUserId = data\.user\?\.id \?\? null/);
  assert.match(edge, /"authenticatedUserId"/);
  assert.match(edge, /link_public_reservation_user/);
});
