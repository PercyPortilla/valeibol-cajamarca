import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261027002805_platform_admin_team_access.sql", "utf8");
const platformAdmin = readFileSync("lib/auth/platformAdmin.ts", "utf8");
const tenantScope = readFileSync("supabase/migrations/20261025075524_pre_b33_platform_admin_tenant_scope.sql", "utf8");
const globalPage = readFileSync("app/admin-global/page.tsx", "utf8");

test("la administración madre admite un equipo de ADMIN globales autorizados", () => {
  assert.match(migration, /drop index if exists public\.user_accounts_single_active_platform_admin/i);
  assert.match(globalPage, /equipo ADMIN global de Caxas Sport Center/i);
  assert.match(platformAdmin, /row\.role !== "admin"/);
});

test("rol global y rol tenant quedan separados sin acceso operativo implícito", () => {
  assert.match(migration, /profiles conserva el rol operativo de cada tenant/i);
  assert.match(migration, /drop trigger if exists user_accounts_block_tenant_owner_admin/i);
  assert.match(migration, /drop trigger if exists profiles_block_platform_admin_owner/i);
  assert.match(migration, /drop trigger if exists businesses_block_platform_admin_primary_owner/i);
  assert.match(tenantScope, /if public\.is_platform_admin\(\) then[\s\S]*?return;/i);
  assert.match(tenantScope, /platform_admin_selected_business_id/i);
});
