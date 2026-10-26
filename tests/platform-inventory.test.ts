import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { businessTodayDateKey } from "../lib/availability.ts";

const migration = readFileSync("supabase/migrations/20261024140000_block20_inventory_management.sql", "utf8");
const globalPage = readFileSync("app/admin-global/page.tsx", "utf8");
const onboarding = readFileSync("components/platform-admin/PlatformAdminBusinessOnboarding.tsx", "utf8");
const configPage = readFileSync("app/admin/(protected)/configuracion/page.tsx", "utf8");
const structurePage = readFileSync("app/admin/(protected)/configuracion/estructura/page.tsx", "utf8");
const structureManager = readFileSync("components/admin/AdminBusinessStructureManager.tsx", "utf8");
const pricingForm = readFileSync("components/admin/AdminPricingForm.tsx", "utf8");
const ownerPortal = readFileSync("app/propietario/page.tsx", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");
const availabilityCalendar = readFileSync("components/availability/AvailabilityCalendar.tsx", "utf8");
const reservationPage = readFileSync("app/reservar/page.tsx", "utf8");
const accessEdge = readFileSync("supabase/functions/admin-access-management/index.ts", "utf8");
const onboardingEdge = readFileSync("supabase/functions/platform-business-onboarding/index.ts", "utf8");
const globalBusinessList = readFileSync("components/platform-admin/PlatformAdminBusinessList.tsx", "utf8");

test("B20 alta global exige ADMIN real y vincula owner + profile de forma atómica", () => {
  const createBusiness = migration.match(/create or replace function public\.platform_admin_create_business[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(createBusiness, /public\.is_platform_admin\(\)/i);
  assert.match(createBusiness, /from auth\.users/i);
  assert.match(createBusiness, /owner_account_not_found/i);
  assert.match(createBusiness, /owner_already_assigned/i);
  assert.match(createBusiness, /update public\.user_accounts[\s\S]*?role = 'owner'/i);
  assert.match(createBusiness, /insert into public\.profiles[\s\S]*?'owner'/i);
  assert.match(createBusiness, /owner_user_id/i);
  assert.doesNotMatch(createBusiness, /delete from public\.(businesses|profiles|user_accounts)/i);
});

test("RPC tenant deriva el negocio desde auth y no acepta business_id autoritativo", () => {
  for (const name of ["admin_update_business_profile", "admin_create_venue", "admin_update_venue", "admin_create_court", "admin_update_court_identity", "admin_set_court_active"]) {
    const fn = migration.match(new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`, "i"))?.[0] ?? "";
    assert.match(fn, /phase6_admin_actor\(\)/i, name);
    assert.match(fn, /role not in \('owner', 'admin'\)/i, name);
    const signature = fn.split("returns")[0] ?? "";
    assert.doesNotMatch(signature, /p_business_id/i, name);
  }
});

test("cancha nueva se publica solo después de horario y pricing reales", () => {
  const createCourt = migration.match(/create or replace function public\.admin_create_court[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(createCourt, /jsonb_array_length\(p_hours\) <> 7/i);
  assert.match(createCourt, /at_least_one_open_day_required/i);
  assert.match(createCourt, /insert into public\.courts[\s\S]*?'confirmed', false/i);
  assert.match(createCourt, /insert into public\.operating_hours/i);
  assert.match(createCourt, /insert into public\.pricing_rules/i);
  assert.match(createCourt, /'without_lights'[\s\S]*?'with_lights'/i);
  assert.match(createCourt, /update public\.courts set is_active = true/i);
});

test("selector de deporte usa catálogo activo devuelto por PostgreSQL", () => {
  const structureFn = migration.match(/create or replace function public\.get_admin_business_structure[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(structureFn, /from public\.sports s[\s\S]*?where s\.is_active/i);
  assert.match(structureManager, /structure\.sports\.map/);
  assert.doesNotMatch(structureManager, /from "@\/config\/sports"/);
});

test("desactivar cancha protege reservas futuras y venue exige apagar canchas primero", () => {
  const courtState = migration.match(/create or replace function public\.admin_set_court_active[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(courtState, /r\.status in \('pending', 'confirmed'\)/i);
  assert.match(courtState, /r\.end_at > now\(\)/i);
  assert.match(courtState, /court_has_future_reservations/i);
  assert.match(migration, /venue_has_active_courts/i);
});

test("autorización tenant exige business y profile activos sin bypass por owner_user_id", () => {
  const canView = migration.match(/create or replace function public\.can_view_business[\s\S]*?\$\$;/i)?.[0] ?? "";
  const canManage = migration.match(/create or replace function public\.can_manage_business[\s\S]*?\$\$;/i)?.[0] ?? "";
  for (const fn of [canView, canManage]) {
    assert.match(fn, /join public\.profiles p on p\.business_id = b\.id/i);
    assert.match(fn, /b\.is_active/i);
    assert.match(fn, /p\.is_active/i);
    assert.doesNotMatch(fn, /owner_user_id\s*=\s*\(select auth\.uid\(\)\)/i);
  }
});

test("owner principal requiere transferencia explícita antes de degradarse o desactivarse", () => {
  const access = migration.match(/create or replace function public\.admin_access_update_profile[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(access, /v_primary_owner_user_id/i);
  assert.match(access, /primary_owner_transfer_required/i);
});

test("ADMIN global no puede suspender tenant con reservas futuras activas", () => {
  const lifecycle = migration.match(/create or replace function public\.platform_admin_set_business_active[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(lifecycle, /public\.is_platform_admin\(\)/i);
  assert.match(lifecycle, /r\.status in \('pending', 'confirmed'\)/i);
  assert.match(lifecycle, /r\.end_at > now\(\)/i);
  assert.match(lifecycle, /business_has_future_reservations/i);
});

test("anon no ejecuta RPC B20 y authenticated mantiene acceso solo por funciones", () => {
  assert.match(migration, /revoke all on function public\.platform_admin_create_business[\s\S]*?from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.platform_admin_create_business[\s\S]*?to authenticated/i);
  assert.match(migration, /revoke all on function public\.get_admin_business_structure\(\) from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /grant (insert|update|delete) on public\.(businesses|venues|courts)/i);
});

test("UX B20 separa alta global de operación tenant y elimina datos estáticos Valeibol", () => {
  assert.match(globalPage, /PlatformAdminBusinessOnboarding/);
  assert.match(onboarding, /platform-business-onboarding/);
  assert.match(onboardingEdge, /platform_admin_create_business/);
  assert.match(onboarding, /Correo del propietario/);
  assert.match(structurePage, /AdminBusinessStructureManager/);
  assert.match(structureManager, /admin_create_venue/);
  assert.match(structureManager, /admin_create_court/);
  assert.match(structureManager, /admin_set_court_active/);
  assert.match(ownerPortal, /\/admin\/configuracion\/estructura/);
  assert.doesNotMatch(configPage, /businessConfig/);
});

test("fechas administrativas aceptan timezone real del tenant", () => {
  const instant = new Date("2026-01-01T01:00:00.000Z");
  assert.equal(businessTodayDateKey(instant, "America/Lima"), "2025-12-31");
  assert.equal(businessTodayDateKey(instant, "Asia/Tokyo"), "2026-01-01");
});

test("reserva pública inicializa calendario con timezone real del tenant", () => {
  assert.match(migration, /business_timezone text/i);
  assert.match(availabilityCalendar, /businessTimezone: string/);
  assert.match(availabilityCalendar, /businessTodayDateKey\(new Date\(\), businessTimezone\)/);
  assert.match(reservationPage, /businessTimezone=\{selectedCourt\.businessTimezone\}/);
});

test("locks de sede serializan desactivación frente a crear o activar canchas", () => {
  const updateVenue = migration.match(/create or replace function public\.admin_update_venue[\s\S]*?\$\$;/i)?.[0] ?? "";
  const createCourt = migration.match(/create or replace function public\.admin_create_court[\s\S]*?\$\$;/i)?.[0] ?? "";
  const setCourt = migration.match(/create or replace function public\.admin_set_court_active[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(updateVenue, /from public\.venues v[\s\S]*?for update/i);
  assert.match(createCourt, /from public\.venues v[\s\S]*?for share/i);
  assert.match(setCourt, /from public\.venues v[\s\S]*?for share/i);
});

test("formularios B20 usan ids únicos y errores locales accesibles", () => {
  for (const id of ["business-name", "new-venue-name", "new-venue-slug", "new-court-name", "new-court-slug", "new-court-sport"]) {
    assert.match(structureManager, new RegExp(`id="${id}"`));
  }
  assert.match(structureManager, /role=\{feedback\.kind === "error" \? "alert" : "status"\}/);
  assert.match(structureManager, /venueCreateBusy/);
  assert.match(structureManager, /courtCreateBusy/);
  assert.match(structureManager, /venueCreateBusy \? "Creando…" : "Crear sede"/);
  assert.match(structureManager, /courtCreateBusy \? "Creando…" : "Crear cancha operativa"/);
});

test("guards B20 devuelven feedback específico en Edge y admin global", () => {
  assert.match(accessEdge, /primary_owner_transfer_required[\s\S]*status:\s*409/);
  assert.match(globalBusinessList, /business_has_future_reservations/);
  assert.match(globalBusinessList, /reservas futuras pendientes o confirmadas/);
  assert.match(globalBusinessList, /role=\{feedback\.kind === "error" \? "alert" : "status"\}/);
});

test("formularios de tarifas usan moneda real del tenant", () => {
  assert.match(structureManager, /structure\.currency/);
  assert.match(pricingForm, /const currency = rules\[0\]\?\.currency \?\? "PEN"/);
  assert.match(pricingForm, /Nueva tarifa por hora \(\{currency\}\)/);
});

test("B20 conserva targets táctiles de 44px y formulario responsive", () => {
  assert.match(styles, /\.global-admin-business-row \.button \{[^}]*min-height:\s*44px/i);
  assert.match(styles, /\.admin-weekly-hours__row \.field__control \{[^}]*min-height:\s*44px/i);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.admin-weekly-hours__row \{ grid-template-columns: 1fr;/i);
});
