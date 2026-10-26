import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("config/platform.ts", "utf8");
const service = readFileSync("lib/data/platformService.ts", "utf8");
const search = readFileSync("app/buscar/page.tsx", "utf8");
const searchForm = readFileSync("components/platform/PlatformSearchForm.tsx", "utf8");
const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const footer = readFileSync("components/platform/PlatformFooter.tsx", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const adminShell = readFileSync("components/admin/AdminShell.tsx", "utf8");
const ownerPortal = readFileSync("app/propietario/page.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20261025075524_pre_b33_platform_admin_tenant_scope.sql", "utf8");

test("marca principal es SportCenter Caxas sin renombrar el tenant Valeibol", () => {
  assert.match(config, /name:\s*"SportCenter Caxas"/);
  assert.match(header, /platformConfig\.name/);
  assert.match(footer, /platformConfig\.name/);
  assert.match(layout, /platformConfig\.name/);
});

test("descubrimiento público queda temporalmente fijado a Cajamarca", () => {
  assert.match(config, /city:\s*"Cajamarca"/);
  assert.match(service, /listCatalog\(\{ \.\.\.query, city: platformConfig\.city \}\)/);
  assert.match(search, /const city = platformConfig\.city/);
  assert.match(searchForm, /value=\{platformConfig\.city\}/);
  assert.match(searchForm, /readOnly/);
  const catalog = migration.match(/create function public\.get_public_platform_catalog[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(catalog, /lower\(coalesce\(v\.city, b\.city, ''\)\) = 'cajamarca'/i);
  assert.match(catalog, /p_city is null or lower\(trim\(p_city\)\) = 'cajamarca'/i);
});

test("reservas web fuera de Cajamarca quedan bloqueadas en base de datos", () => {
  const guard = migration.match(/create or replace function private\.guard_new_reservation_business_published[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(guard, /new\.source = 'public_web'/i);
  assert.match(guard, /join public\.venues v/i);
  assert.match(guard, /lower\(coalesce\(v\.city, b\.city, ''\)\) = 'cajamarca'/i);
});

test("dueño conserva su tenant y ADMIN global entra solo al negocio seleccionado", () => {
  const actor = migration.match(/create or replace function public\.phase6_admin_actor[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(actor, /private\.platform_admin_selected_business_id\(\)/i);
  assert.match(actor, /'admin'::public\.app_role/i);
  assert.match(actor, /from public\.profiles p/i);
  assert.match(actor, /p\.user_id = auth\.uid\(\)/i);
  assert.doesNotMatch(actor.match(/if v_selected_business_id is not null then[\s\S]*?return;/i)?.[0] ?? "", /b\.is_active/i);
  assert.match(adminShell, /context\.isPlatformAdmin/);
  assert.match(adminShell, /Administración principal/);
  assert.match(ownerPortal, /Cada propietario administra únicamente su propio negocio/);
});

test("solo puede existir un ADMIN global activo", () => {
  assert.match(migration, /create unique index if not exists user_accounts_single_active_platform_admin/i);
  assert.match(migration, /on public\.user_accounts \(\(1\)\)[\s\S]*?where role = 'admin' and is_active/i);
});
