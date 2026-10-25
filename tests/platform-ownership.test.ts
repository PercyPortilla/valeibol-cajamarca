import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261024160000_block21_primary_owner_transfer.sql", "utf8");
const edge = readFileSync("supabase/functions/admin-access-management/index.ts", "utf8");
const accessUi = readFileSync("components/admin/AdminAccessManagement.tsx", "utf8");
const configPage = readFileSync("app/admin/(protected)/configuracion/page.tsx", "utf8");
const globalAdmin = readFileSync("app/admin-global/page.tsx", "utf8");
const globalBusinessList = readFileSync("components/platform-admin/PlatformAdminBusinessList.tsx", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");
const databaseTypes = readFileSync("lib/data/supabase/database.types.ts", "utf8");

test("B21 transfiere owner principal solo desde el principal actual del mismo tenant", () => {
  assert.match(migration, /create or replace function public\.admin_access_transfer_primary_owner/i);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /from public\.profiles p[\s\S]*?for update[\s\S]*?from public\.businesses b[\s\S]*?owner_user_id = p_actor_user_id[\s\S]*?for update/i);
  assert.match(migration, /p\.user_id = p_actor_user_id[\s\S]*?p\.role = 'owner'/i);
  assert.match(migration, /ua\.user_id = p_actor_user_id[\s\S]*?ua\.role = 'owner'/i);
  assert.match(migration, /p\.user_id = p_target_user_id[\s\S]*?p\.business_id = v_business\.id/i);
  assert.doesNotMatch(migration, /p_business_id/i);
});

test("tipos Supabase incluyen RPC B21 aunque la Edge la invoque con service role", () => {
  assert.match(databaseTypes, /admin_access_transfer_primary_owner/);
  assert.match(databaseTypes, /previous_owner_user_id: string/);
});

test("target debe estar activo, confirmado y nunca ser ADMIN global", () => {
  assert.match(migration, /ownership_target_inactive/i);
  assert.match(migration, /email_confirmed_at is not null/i);
  assert.match(migration, /ownership_target_unconfirmed/i);
  assert.match(migration, /v_target_account\.role = 'admin'/i);
  assert.match(migration, /platform_admin_cannot_be_tenant_owner/i);
});

test("invariante DB bloquea ADMIN global como owner por cualquier ruta de escritura", () => {
  assert.match(migration, /guard_profile_owner_not_platform_admin/i);
  assert.match(migration, /profiles_block_platform_admin_owner/i);
  assert.match(migration, /guard_platform_admin_not_tenant_owner/i);
  assert.match(migration, /user_accounts_block_tenant_owner_admin/i);
  assert.match(migration, /guard_business_primary_owner_not_platform_admin/i);
  assert.match(migration, /businesses_block_platform_admin_primary_owner/i);
  assert.match(migration, /guard_profile_owner_not_platform_admin[\s\S]*?pg_advisory_xact_lock\(hashtext\(new\.user_id::text\)\)/i);
  assert.match(migration, /guard_platform_admin_not_tenant_owner[\s\S]*?pg_advisory_xact_lock\(hashtext\(new\.user_id::text\)\)/i);
  assert.match(migration, /guard_business_primary_owner_not_platform_admin[\s\S]*?pg_advisory_xact_lock\(hashtext\(new\.owner_user_id::text\)\)/i);
  assert.match(migration, /tenant_owner_cannot_be_platform_admin/i);
  assert.match(migration, /existing_platform_admin_tenant_owner_conflict/i);
});

test("transferencia promueve target y no degrada automáticamente al owner anterior", () => {
  assert.match(migration, /update public\.profiles[\s\S]*?set role = 'owner'/i);
  assert.match(migration, /update public\.user_accounts[\s\S]*?set role = 'owner'/i);
  assert.match(migration, /update public\.businesses[\s\S]*?owner_user_id = p_target_user_id/i);
  assert.doesNotMatch(migration, /update public\.profiles[\s\S]*?where user_id = p_actor_user_id/i);
});

test("RPC de transferencia queda service-role only", () => {
  assert.match(migration, /revoke all on function public\.admin_access_transfer_primary_owner\(uuid,uuid\)[\s\S]*?from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.admin_access_transfer_primary_owner\(uuid,uuid\)[\s\S]*?to service_role/i);
});

test("Edge deriva actor desde JWT y expone elegibilidad sin owner_user_id crudo", () => {
  assert.match(edge, /action: "transfer_owner"/);
  assert.match(edge, /p_actor_user_id: callerUserId/);
  assert.match(edge, /p_target_user_id: body\.userId/);
  assert.match(edge, /isPrimaryOwner/);
  assert.match(edge, /canReceivePrimaryOwnership/);
  assert.match(edge, /canTransferPrimaryOwnership: callerUserId === business\.owner_user_id/);
  assert.doesNotMatch(edge, /primaryOwnerUserId:\s*business\.owner_user_id/);
});

test("UI separa rol Owner de propiedad principal con confirmación explícita", () => {
  assert.match(accessUi, /Propietario principal/);
  assert.match(accessUi, /Transferir propiedad principal/);
  assert.match(accessUi, /Tu cuenta seguirá como Propietario activo/);
  assert.match(accessUi, /canReceivePrimaryOwnership/);
  assert.match(accessUi, /canTransferPrimaryOwnership/);
  assert.match(accessUi, /cancelTransferRef/);
  assert.match(accessUi, /transferTriggerRef/);
  assert.match(accessUi, /requestAnimationFrame\(\(\) => transferTriggerRef\.current\?\.focus\(\)\)/);
  assert.match(accessUi, /disabled=\{isCurrentUser \|\| user\.isPrimaryOwner\}/);
  assert.match(accessUi, /No hay otro usuario activo y verificado elegible/);
  assert.match(accessUi, /role=\{messageKind === "error" \? "alert" : "status"\}/);
  assert.match(accessUi, /setRole\(user\.role\)/);
  assert.match(accessUi, /setIsActive\(user\.isActive\)/);
  assert.match(accessUi, /transferMessageRef/);
  assert.match(accessUi, /role="status" tabIndex=\{-1\}/);
  assert.match(accessUi, /La propiedad principal se transfirió a \$\{email\}/);
  assert.match(configPage, /businessName=\{context\.businessName\}/);
});

test("ADMIN global no recibe acción ordinaria de transferencia", () => {
  assert.doesNotMatch(globalAdmin, /transfer_owner|Transferir propiedad principal/);
  assert.doesNotMatch(globalBusinessList, /transfer_owner|Transferir propiedad principal/);
});

test("confirmación B21 conserva targets táctiles y responsive", () => {
  assert.match(styles, /\.admin-owner-transfer__actions \.button \{ min-height: 44px; \}/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?\.admin-owner-transfer \{ align-items: stretch; flex-direction: column; \}/);
});

\n