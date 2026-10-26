import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const edge = readFileSync("supabase/functions/platform-business-onboarding/index.ts", "utf8");
const ui = readFileSync("components/platform-admin/PlatformAdminBusinessOnboarding.tsx", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const inventoryMigration = readFileSync("supabase/migrations/20261024140000_block20_inventory_management.sql", "utf8");

test("B32 protege onboarding con JWT y revalida ADMIN global activo", () => {
  assert.match(config, /\[functions\.platform-business-onboarding\][\s\S]*?verify_jwt\s*=\s*true/i);
  assert.match(edge, /admin\.auth\.getUser\(token\)/);
  assert.match(edge, /from\("user_accounts"\)[\s\S]*?\.eq\("user_id", callerData\.user\.id\)/);
  assert.match(edge, /callerAccount\.role !== "admin" \|\| !callerAccount\.is_active/);
  assert.match(edge, /platform_admin_access_denied/);
});

test("B32 conserva la identidad JWT del ADMIN al ejecutar la RPC autoritativa B20", () => {
  assert.match(edge, /global:\s*\{\s*headers:\s*\{ Authorization: `Bearer \$\{token\}` \}/);
  assert.match(edge, /caller\.rpc\("platform_admin_create_business", rpcInput\)/);
  const createBusiness = inventoryMigration.match(/create or replace function public\.platform_admin_create_business[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(createBusiness, /public\.is_platform_admin\(\)/);
  assert.match(createBusiness, /owner_already_assigned/);
  assert.match(createBusiness, /platform_admin_cannot_be_tenant_owner/);
});

test("B32 invita únicamente cuando la RPC confirma que el owner no existe", () => {
  const firstCreate = edge.indexOf("let creation = await createBusiness()");
  const notFoundCheck = edge.indexOf('initialError.code !== "owner_account_not_found"');
  const invite = edge.indexOf("admin.auth.admin.inviteUserByEmail");
  assert.ok(firstCreate >= 0 && notFoundCheck > firstCreate && invite > notFoundCheck);
  assert.match(edge, /ADMIN_INVITE_REDIRECT_URL/);
  assert.match(edge, /\/admin\/activar/);
});

test("B32 revierte solo el Auth user recién invitado si el alta atómica falla", () => {
  assert.match(edge, /const invitedUserId = inviteData\.user\.id/);
  assert.match(edge, /creation = await createBusiness\(\)[\s\S]*?if \(creation\.error\)[\s\S]*?admin\.auth\.admin\.deleteUser\(invitedUserId\)/);
  assert.doesNotMatch(edge, /deleteUser\(body\.|deleteUser\(callerData/);
});

test("B32 tolera carrera de registro sin borrar una identidad ajena", () => {
  const raceBlock = edge.match(/if \(mappedInvite\.code === "email_in_use"\) \{[\s\S]*?\n    \}/)?.[0] ?? "";
  assert.match(raceBlock, /creation = await createBusiness\(\)/);
  assert.doesNotMatch(raceBlock, /deleteUser/);
});

test("UI global ya no obliga al owner a crear primero una cuenta", () => {
  assert.match(ui, /functions\.invoke<OnboardingResponse>\("platform-business-onboarding"/);
  assert.doesNotMatch(ui, /\.rpc\("platform_admin_create_business"/);
  assert.doesNotMatch(ui, /debe tener primero una cuenta/i);
  assert.match(ui, /Si todavía no existe, la plataforma crea una invitación segura/);
  assert.match(ui, /Enviamos al propietario una invitación para crear su contraseña/);
});

test("payload B32 no acepta actor, role ni user_id desde el navegador", () => {
  const allowedKeys = edge.match(/const ALLOWED_KEYS = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? "";
  assert.doesNotMatch(allowedKeys, /actor|role|userId|user_id/i);
  assert.match(allowedKeys, /ownerEmail/);
});
