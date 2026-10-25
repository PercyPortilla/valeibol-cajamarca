import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261024200000_block25_platform_business_core_settings.sql", "utf8");
const list = readFileSync("components/platform-admin/PlatformAdminBusinessList.tsx", "utf8");
const page = readFileSync("app/admin-global/page.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");

function mutation() {
  return migration.match(/create or replace function public\.platform_admin_update_business_core[\s\S]*?\$\$;/i)?.[0] ?? "";
}

test("B25 mantiene configuración estructural bajo ADMIN global explícito", () => {
  const fn = mutation();
  assert.match(fn, /public\.is_platform_admin\(\)/i);
  assert.match(fn, /from public\.businesses b[\s\S]*?for update/i);
  assert.match(fn, /configuration_status <> 'provisional'/i);
  assert.doesNotMatch(fn, /public\.profiles/i);
  assert.doesNotMatch(fn, /owner_user_id/i);
});

test("B25 valida slug moneda y timezone antes de escribir", () => {
  const fn = mutation();
  assert.match(fn, /v_slug !~ '\^\[a-z0-9\]/i);
  assert.match(fn, /v_currency !~ '\^\[A-Z\]\{3\}\$'/i);
  assert.match(fn, /pg_timezone_names/i);
  assert.match(fn, /business_slug_taken/i);
});

test("B25 protege semántica histórica monetaria y temporal", () => {
  const fn = mutation();
  assert.match(fn, /currency_change_blocked_by_reservation_history/i);
  assert.match(fn, /timezone_change_blocked_by_schedule_history/i);
  assert.match(fn, /public\.reservations/i);
  assert.match(fn, /public\.schedule_blocks/i);
  assert.doesNotMatch(fn, /update public\.reservations/i);
  assert.doesNotMatch(fn, /update public\.pricing_rules/i);
  assert.doesNotMatch(fn, /update public\.operating_hours/i);
});

test("listado global añade solo metadatos estructurales, no owner ni PII", () => {
  const fn = migration.match(/create function public\.get_platform_admin_businesses_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /configuration_status public\.configuration_status/i);
  assert.match(fn, /currency text/i);
  assert.match(fn, /timezone text/i);
  assert.doesNotMatch(fn, /owner_user_id/i);
  assert.doesNotMatch(fn, /customer|phone_e164|email/i);
  assert.match(page, /configurationStatus: row\.configuration_status/);
  assert.match(page, /currency: row\.currency/);
  assert.match(page, /timezone: row\.timezone/);
});

test("anon no puede ejecutar mutación B25 y tipos Supabase están sincronizados", () => {
  assert.match(migration, /revoke all on function public\.platform_admin_update_business_core\(uuid,text,text,text\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.platform_admin_update_business_core\(uuid,text,text,text\) to authenticated/i);
  assert.match(types, /platform_admin_update_business_core/);
  assert.match(types, /configuration_status: "provisional" \| "confirmed"/);
});

test("UX B25 exige tenant no publicado y explica límites", () => {
  assert.match(list, /business\.configurationStatus !== "provisional"/);
  assert.match(list, /Editar configuración/);
  assert.match(list, /retirar la publicación/i);
  assert.match(list, /no se convierten importes ni horarios existentes automáticamente/i);
  assert.match(list, /Guardando…/);
  assert.match(styles, /\.global-admin-business-core-form input \{[^}]*min-height: 44px/i);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.global-admin-business-core-form \{ display: grid; grid-template-columns: 1fr;/i);
});
