import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261023092310_platform_admin_dashboard.sql", "utf8");
const multitenant = readFileSync("supabase/migrations/20261023085123_global_multitenant_schema.sql", "utf8");
const auth = readFileSync("lib/auth/platformAdmin.ts", "utf8");

test("admin global se deriva solo de user_accounts.role=admin", () => {
  const context = migration.match(/create or replace function public\.get_platform_admin_context[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(context, /public\.user_accounts/i);
  assert.match(context, /ua\.role = 'admin'/i);
  assert.doesNotMatch(context, /public\.profiles/i);
  assert.match(auth, /row\.role !== "admin"/);
});

test("legacy admin de negocio no se eleva automáticamente a admin global", () => {
  const backfill = multitenant.match(/update public\.user_accounts ua[\s\S]*?where ua\.user_id = derived\.user_id;/i)?.[0] ?? "";
  assert.doesNotMatch(backfill, /p\.role = 'admin'[^\n]+then 'admin'/i);
});

test("todas las RPC globales mutables verifican is_platform_admin", () => {
  const mutation = migration.match(/create or replace function public\.platform_admin_set_business_active[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(mutation, /public\.is_platform_admin\(\)/i);
  assert.match(mutation, /update public\.businesses/i);
  assert.doesNotMatch(mutation, /delete from public\.businesses/i);
});

test("anon no recibe RPC globales", () => {
  assert.match(migration, /revoke all on function public\.get_platform_admin_context\(\) from public, anon/i);
  assert.match(migration, /revoke all on function public\.platform_admin_set_business_active\(uuid,boolean\) from public, anon/i);
});
