import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025083500_block34_existing_account_tenant_access.sql", "utf8");
const edge = readFileSync("supabase/functions/admin-access-management/index.ts", "utf8");
const ui = readFileSync("components/admin/AdminAccessManagement.tsx", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B34 vincula por email solo desde service_role y conserva el aislamiento del tenant", () => {
  const fn = migration.match(/create or replace function public\.admin_access_link_existing_profile[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /from auth\.users/i);
  assert.match(fn, /lower\(u\.email\) = v_email/i);
  assert.match(fn, /u\.email_confirmed_at is not null/i);
  assert.match(fn, /p\.role = 'owner'/i);
  assert.match(fn, /b\.is_active/i);
  assert.match(fn, /user_assigned_elsewhere/i);
  assert.match(fn, /user_already_in_business/i);
  assert.match(fn, /platform_admin_cannot_join_tenant/i);
  assert.match(fn, /pg_advisory_xact_lock/i);
  assert.match(migration, /revoke all on function public\.admin_access_link_existing_profile[\s\S]*?from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.admin_access_link_existing_profile[\s\S]*?to service_role/i);
});

test("Edge intenta vincular cuenta existente antes de crear una invitación nueva", () => {
  const branch = edge.match(/if \(body\.action === "invite"\) \{[\s\S]*?if \(body\.action === "transfer_owner"\)/)?.[0] ?? "";
  const linkIndex = branch.indexOf('admin_access_link_existing_profile');
  const inviteIndex = branch.indexOf('inviteUserByEmail');
  assert.ok(linkIndex >= 0, "falta RPC de vinculación existente");
  assert.ok(inviteIndex > linkIndex, "la invitación no debe ejecutarse antes de intentar vincular");
  assert.match(branch, /existing_account_not_found/);
  assert.match(branch, /mapped\.code === "email_in_use"[\s\S]*?linkExistingProfile\(\)/);
  assert.match(branch, /accessMode:\s*"linked"/);
  assert.match(branch, /accessMode:\s*"invited"/);
});

test("UI explica si vinculó una cuenta Caxas o envió una invitación", () => {
  assert.match(ui, /accessMode\?: "linked" \| "invited"/);
  assert.match(ui, /La cuenta ya existía en Caxas y quedó vinculada a este negocio/);
  assert.match(ui, /Invitación enviada/);
  assert.match(ui, /Esa cuenta ya pertenece a otro negocio/);
  assert.match(ui, /cuenta ADMIN global no puede añadirse/i);
  assert.match(ui, /se vinculará sin crear otra/i);
  assert.match(ui, /Agregar usuario/);
});

test("SQL E2E incluye el contrato B34", () => {
  assert.match(sqlRunner, /platform_existing_account_access\.sql/);
});

