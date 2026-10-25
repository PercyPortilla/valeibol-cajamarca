import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261024190000_block24_tenant_readiness.sql", "utf8");
const manager = readFileSync("components/admin/AdminBusinessStructureManager.tsx", "utf8");
const inventory = readFileSync("lib/admin/inventory.ts", "utf8");
const service = readFileSync("lib/data/inventoryService.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");

function publicationFunction() {
  return migration.match(/create or replace function public\.admin_set_business_configuration_status[\s\S]*?\$\$;/i)?.[0] ?? "";
}

test("B24 deriva tenant y restringe publicación a owner/admin", () => {
  const fn = publicationFunction();
  assert.match(fn, /phase6_admin_actor\(\)/i);
  assert.match(fn, /v_actor\.role not in \('owner', 'admin'\)/i);
  assert.doesNotMatch(fn.split("returns")[0] ?? "", /p_business_id/i);
  assert.match(fn, /b\.id = v_actor\.business_id/i);
});

test("B24 usa business lock y readiness DB-authoritativo", () => {
  const fn = publicationFunction();
  assert.match(fn, /from public\.businesses b[\s\S]*?for update/i);
  assert.match(fn, /private\.business_publication_readiness\(v_business\.id\)/i);
  assert.match(migration, /count\(distinct oh\.weekday\)[\s\S]*?<> 7/i);
  assert.match(migration, /count\(distinct pr\.lighting\)[\s\S]*?<> 2/i);
  assert.match(migration, /oh\.configuration_status = 'confirmed'/i);
  assert.match(migration, /pr\.configuration_status = 'confirmed'/i);
});

test("B24 separa publication status de suspensión global y no cancela reservas", () => {
  const fn = publicationFunction();
  assert.match(fn, /set configuration_status = p_status/i);
  assert.doesNotMatch(fn, /set is_active/i);
  assert.doesNotMatch(fn, /update public\.reservations/i);
  assert.doesNotMatch(fn, /delete from public\.reservations/i);
  assert.match(fn, /availability_revisions/i);
});

test("todas las superficies públicas operativas exigen tenant confirmed", () => {
  for (const name of [
    "get_public_availability",
    "get_public_pricing_for_date",
    "get_public_business_config",
    "get_public_booking_context",
    "get_public_platform_catalog",
    "get_public_site_content",
    "get_public_business_reviews",
  ]) {
    const start = migration.indexOf(`function public.${name}`);
    assert.ok(start >= 0, name);
    const fragment = migration.slice(start, start + 9000);
    assert.match(fragment, /configuration_status = 'confirmed'/i, name);
  }
});

test("B24 mantiene un tenant publicado con al menos una cancha lista", () => {
  const courtFn = migration.match(/create or replace function public\.admin_set_court_active[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(courtFn, /from public\.businesses b[\s\S]*?for update/i);
  assert.match(courtFn, /from public\.courts c[\s\S]*?for update/i);
  assert.ok(courtFn.indexOf("from public.businesses b") < courtFn.indexOf("from public.courts c"));
  assert.match(courtFn, /published_business_requires_ready_court/i);
  assert.match(courtFn, /business_publication_readiness/i);
});

test("B24 no exige status confirmed de cancha sin flujo propio", () => {
  const readiness = migration.match(/create or replace function private\.business_publication_readiness[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.doesNotMatch(readiness, /c\.configuration_status <> 'confirmed'/i);
  assert.match(readiness, /oh\.configuration_status = 'confirmed'/i);
  assert.match(readiness, /pr\.configuration_status = 'confirmed'/i);
});

test("detalle Valeibol no salta el gating del catálogo", () => {
  const page = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
  assert.match(page, /if \(!business\) notFound\(\);[\s\S]*?if \(slug === businessConfig\.slug\)/);
  assert.doesNotMatch(page, /slug === businessConfig\.slug && !business/);
});

test("una reserva nueva queda bloqueada si el tenant no está publicado", () => {
  assert.match(migration, /create or replace function private\.guard_new_reservation_business_published/i);
  assert.match(migration, /if new\.source = 'public_web' and not exists/i);
  assert.match(migration, /before insert on public\.reservations/i);
  assert.match(migration, /business_not_published/i);
  assert.doesNotMatch(migration, /before (insert or update|update or insert) on public\.reservations/i);
});

test("retirar publicación no bloquea altas internas del panel", () => {
  const guard = migration.match(/create or replace function private\.guard_new_reservation_business_published[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(guard, /new\.source = 'public_web'/i);
  assert.doesNotMatch(guard, /new\.created_by is null/i);
});

test("B24 conserva tenants operativos ya públicos mediante backfill condicionado", () => {
  assert.match(migration, /update public\.operating_hours oh[\s\S]*?configuration_status = 'confirmed'/i);
  assert.match(migration, /where b\.is_active and b\.configuration_status = 'provisional'/i);
  assert.match(migration, /private\.business_publication_readiness\(v_business_id\)/i);
  assert.match(migration, /set configuration_status = 'confirmed'/i);
});

test("estructura admin carga readiness y expone publicación sin business_id", () => {
  assert.match(service, /client\.rpc\("get_admin_publication_readiness"\)/);
  assert.match(inventory, /publicationReadiness:/);
  assert.match(types, /get_admin_publication_readiness/);
  assert.match(types, /admin_set_business_configuration_status/);
  assert.match(manager, /Publicación del negocio/);
  assert.match(manager, /admin_set_business_configuration_status/);
  assert.match(manager, /Publicar negocio/);
  assert.match(manager, /Retirar de publicación/);
  const structureFn = migration.match(/create or replace function public\.get_admin_business_structure[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(structureFn, /'hoursConfigured'[\s\S]*?oh\.configuration_status = 'confirmed'/i);
  assert.match(structureFn, /'pricingConfigured'[\s\S]*?pr\.configuration_status = 'confirmed'/i);
});

test("UX B24 distingue staff read-only, busy y feedback accesible", () => {
  assert.match(manager, /canManage && !localMode/);
  assert.match(manager, /publicationBusy \? "Publicando…" : "Publicar negocio"/);
  assert.match(manager, /publicationBusy \? "Retirando…" : "Retirar de publicación"/);
  assert.match(manager, /<FeedbackMessage feedback=\{publicationFeedback\}/);
  assert.match(styles, /\.admin-publication-control__actions \.button \{ min-height: 44px; \}/i);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.admin-publication-control__actions \.button \{ width: 100%; \}/i);
});

\n