import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025090000_block36_platform_owner_recovery.sql", "utf8");
const edge = readFileSync("supabase/functions/platform-owner-recovery/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const ui = readFileSync("components/platform-admin/PlatformAdminBusinessList.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B36 recupera owner solo para ADMIN global y conserva aislamiento mono-tenant", () => {
  const fn = migration.match(/create or replace function public\.platform_admin_recover_primary_owner[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /public\.is_platform_admin\(\)/);
  assert.match(fn, /from auth\.users/i);
  assert.match(fn, /lower\(u\.email\) = v_owner_email/i);
  assert.match(fn, /email_confirmed_at is not null or u\.invited_at is not null/i);
  assert.match(fn, /owner_account_unconfirmed/i);
  assert.match(fn, /owner_already_assigned/i);
  assert.match(fn, /platform_admin_cannot_be_tenant_owner/i);
  assert.match(fn, /v_previous_owner_user_id <> v_owner_user_id/i);
  assert.match(fn, /set is_active = false/i);
  assert.match(fn, /update public\.businesses[\s\S]*?owner_user_id = v_owner_user_id/i);
  assert.match(migration, /revoke all on function public\.platform_admin_recover_primary_owner\(uuid,text\)[\s\S]*?from public, anon/i);
});

test("B36 mantiene orden de locks compatible con transferencia ordinaria B21", () => {
  const fn = migration.match(/create or replace function public\.platform_admin_recover_primary_owner[\s\S]*?\$\$;/i)?.[0] ?? "";
  const profilesLock = fn.indexOf("from public.profiles p");
  const businessLock = fn.indexOf("from public.businesses b", profilesLock + 1);
  const accountLock = fn.indexOf("from public.user_accounts ua", businessLock + 1);
  assert.ok(profilesLock >= 0 && businessLock > profilesLock && accountLock > businessLock);
  assert.match(fn, /for update/gi);
});

test("Edge B36 exige JWT, revalida ADMIN y solo invita tras owner_account_not_found", () => {
  assert.match(config, /\[functions\.platform-owner-recovery\][\s\S]*?verify_jwt\s*=\s*true/i);
  assert.match(edge, /admin\.auth\.getUser\(token\)/);
  assert.match(edge, /callerAccount\.role !== "admin" \|\| !callerAccount\.is_active/);
  assert.match(edge, /caller\.rpc\("platform_admin_recover_primary_owner"/);
  assert.match(edge, /owner_account_unconfirmed/);
  const firstRecovery = edge.indexOf("let recovery = await recoverOwner()");
  const notFound = edge.indexOf('initialError.code !== "owner_account_not_found"');
  const invite = edge.indexOf("inviteUserByEmail");
  assert.ok(firstRecovery >= 0 && notFound > firstRecovery && invite > notFound);
  assert.match(edge, /deleteUser\(invitedUserId\)/);
});

test("payload B36 no acepta actor, role ni owner user id desde navegador", () => {
  const parser = edge.match(/function parseBody[\s\S]*?return \{ businessId, ownerEmail \};\n\}/)?.[0] ?? "";
  assert.match(parser, /businessId/);
  assert.match(parser, /ownerEmail/);
  assert.doesNotMatch(parser, /actor|role|ownerUserId|user_id/i);
});

test("tipos y SQL runner incluyen recuperación B36", () => {
  assert.match(types, /platform_admin_recover_primary_owner/);
  assert.match(sqlRunner, /platform_owner_recovery\.sql/);
});

test("UI global expone recuperación extraordinaria sin serializar owner actual", () => {
  assert.match(ui, /Recuperar propietario/);
  assert.match(ui, /platform-owner-recovery/);
  assert.match(ui, /ownerEmail/);
  assert.doesNotMatch(ui, /ownerUserId|previousOwnerUserId/);
});

