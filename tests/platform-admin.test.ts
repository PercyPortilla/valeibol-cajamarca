import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261023092310_platform_admin_dashboard.sql", "utf8");
const metricsMigration = readFileSync("supabase/migrations/20261023213107_block9_platform_admin_metrics.sql", "utf8");
const multitenant = readFileSync("supabase/migrations/20261023085123_global_multitenant_schema.sql", "utf8");
const auth = readFileSync("lib/auth/platformAdmin.ts", "utf8");
const page = readFileSync("app/admin-global/page.tsx", "utf8");
const businessList = readFileSync("components/platform-admin/PlatformAdminBusinessList.tsx", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");
const scopeMigration = readFileSync("supabase/migrations/20261025075524_pre_b33_platform_admin_tenant_scope.sql", "utf8");
const scopeRoute = readFileSync("app/api/admin-global/select-business/route.ts", "utf8");
const browserClient = readFileSync("lib/data/supabase/browser.ts", "utf8");
const serverClient = readFileSync("lib/data/supabase/server.ts", "utf8");

test("admin global se deriva solo de user_accounts.role=admin", () => {
  const context = migration.match(/create or replace function public\.get_platform_admin_context[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(context, /public\.user_accounts/i);
  assert.match(context, /ua\.role = 'admin'/i);
  assert.doesNotMatch(context, /public\.profiles/i);
  assert.match(auth, /row\.role !== "admin"/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
});

test("legacy admin de negocio no se eleva automáticamente a admin global", () => {
  const backfill = multitenant.match(/update public\.user_accounts ua[\s\S]*?where ua\.user_id = derived\.user_id;/i)?.[0] ?? "";
  assert.doesNotMatch(backfill, /p\.role = 'admin'[^\n]+then 'admin'/i);
});

test("admin global no hereda lectura directa de PII tenant", () => {
  const canView = metricsMigration.match(/create or replace function public\.can_view_business[\s\S]*?\$\$;/i)?.[0] ?? "";
  const canManage = metricsMigration.match(/create or replace function public\.can_manage_business[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.doesNotMatch(canView, /public\.is_platform_admin\(\)/i);
  assert.doesNotMatch(canManage, /public\.is_platform_admin\(\)/i);
  assert.match(metricsMigration, /create policy user_accounts_self_select[\s\S]*?user_id = \(select auth\.uid\(\)\)/i);
  assert.doesNotMatch(metricsMigration.match(/create policy user_accounts_self_select[\s\S]*?;/i)?.[0] ?? "", /is_platform_admin/i);
});

test("ajuste pre-B33 permite supervisión tenant solo con scope explícito del único ADMIN global", () => {
  assert.match(scopeMigration, /user_accounts_single_active_platform_admin/i);
  assert.match(scopeMigration, /where role = 'admin' and is_active/i);
  assert.match(scopeMigration, /platform_admin_selected_business_id/i);
  assert.match(scopeMigration, /current_setting\('request\.headers', true\)/i);
  assert.match(scopeMigration, /x-platform-business-id/i);
  assert.match(scopeMigration, /public\.is_platform_admin\(\)/i);
  assert.match(scopeMigration, /private\.platform_admin_selected_business_id\(\) = target_business_id/i);
  assert.doesNotMatch(scopeMigration, /public\.is_platform_admin\(\)\s*\)/i);
});

test("scope global viaja por cookie/header y solo lo crea una ruta protegida", () => {
  assert.match(scopeRoute, /requirePlatformAdminContext\(\)/);
  assert.match(scopeRoute, /PLATFORM_ADMIN_BUSINESS_COOKIE/);
  assert.match(browserClient, /PLATFORM_ADMIN_BUSINESS_HEADER/);
  assert.match(serverClient, /PLATFORM_ADMIN_BUSINESS_HEADER/);
  assert.match(browserClient, /readPlatformBusinessIdFromDocument/);
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
  assert.match(metricsMigration, /revoke all on function public\.get_platform_admin_businesses_page\(integer,integer\) from public, anon/i);
});

test("RPC global efectiva no devuelve pagos ni habilita el listado legado con owner_user_id", () => {
  const summary = metricsMigration.match(/create function public\.get_platform_admin_summary[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.doesNotMatch(summary, /payment_reports_total|reservation_payments/i);
  assert.match(metricsMigration, /revoke all on function public\.get_platform_admin_businesses\(integer\) from public, anon, authenticated/i);
});

test("resumen global cuenta usuarios totales y oferta activa de tenants activos", () => {
  assert.match(metricsMigration, /\(select count\(\*\) from public\.user_accounts\)/i);
  assert.match(metricsMigration, /from public\.venues v[\s\S]*?join public\.businesses b[\s\S]*?v\.is_active[\s\S]*?b\.is_active/i);
  assert.match(metricsMigration, /from public\.courts c[\s\S]*?join public\.venues v[\s\S]*?join public\.businesses b[\s\S]*?c\.is_active[\s\S]*?v\.is_active[\s\S]*?b\.is_active/i);
});

test("listado global pagina tenants sin serializar owner_user_id al cliente", () => {
  assert.match(metricsMigration, /get_platform_admin_businesses_page/i);
  assert.match(metricsMigration, /offset greatest\(coalesce\(p_offset, 0\), 0\)/i);
  const pagedFunction = metricsMigration.match(/create or replace function public\.get_platform_admin_businesses_page[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.doesNotMatch(pagedFunction, /owner_user_id/i);
  assert.match(page, /get_platform_admin_businesses_page/);
  assert.doesNotMatch(page, /ownerUserId/);
  assert.doesNotMatch(businessList, /ownerUserId/);
  assert.match(page, /pageSize=\{PAGE_SIZE\}/);
  assert.match(businessList, /Mostrando/);
});

test("panel global no deja hueco de sexta métrica tras ocultar pagos", () => {
  assert.doesNotMatch(page, /Reportes de pago/i);
  assert.match(styles, /\.global-admin-metrics \{[^}]*grid-template-columns:\s*repeat\(5,/i);
});

test("UX global evita enlaces muertos y protege la desactivación", () => {
  assert.doesNotMatch(page, /get_current_admin_context/);
  assert.match(businessList, /Administrar negocio/);
  assert.match(businessList, /\/api\/admin-global\/select-business/);
  assert.match(businessList, /window\.confirm/);
  assert.match(businessList, /disabled=\{Boolean\(busyId\)\}/);
  assert.match(styles, /\.global-admin-links a \{[^}]*min-height:\s*44px/i);
});
