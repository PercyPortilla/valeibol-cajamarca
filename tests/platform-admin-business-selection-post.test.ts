import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validPlatformBusinessId } from "../lib/auth/platformScope.ts";

const list = readFileSync("components/platform-admin/PlatformAdminBusinessList.tsx", "utf8");
const route = readFileSync("app/api/admin-global/select-business/route.ts", "utf8");
const accessDenied = readFileSync("app/admin/acceso-denegado/page.tsx", "utf8");
const server = readFileSync("lib/data/supabase/server.ts", "utf8");
const scopeMigration = readFileSync("supabase/migrations/20261025075524_pre_b33_platform_admin_tenant_scope.sql", "utf8");

test("Administrar negocio usa formulario POST nativo, no navegación SPA hacia una ruta que escribe cookies", () => {
  assert.match(list, /<form action="\/api\/admin-global\/select-business" method="post"/);
  assert.match(list, /<input type="hidden" name="businessId" value=\{business\.businessId\}/);
  assert.match(list, /<button type="submit" className="button button--primary">/);
  assert.doesNotMatch(list, /href=\{`\/api\/admin-global\/select-business/);
});

test("selección de negocio protege origen y sesión ADMIN global antes de instalar el ámbito", () => {
  const post = route.split("export async function POST")[1]?.split("export async function GET")[0] ?? "";
  assert.match(post, /request\.headers\.get\("origin"\)/);
  assert.match(post, /request\.headers\.get\("host"\)/);
  assert.match(post, /request\.headers\.get\("x-forwarded-host"\)/);
  assert.match(post, /request\.nextUrl\.host/);
  assert.match(post, /allowedHosts\.includes\(originHost\)/);
  assert.match(post, /"same-origin"/);
  assert.match(post, /status: 403/);
  assert.match(post, /await requirePlatformAdminContext\(\)/);
  assert.match(post, /await request\.formData\(\)/);
  assert.match(post, /validPlatformBusinessId/);
  assert.match(post, /status: 303/);
  assert.match(post, /Location: "\/admin"/);
  assert.doesNotMatch(post, /NextResponse\.redirect\(new URL\("\/admin", request\.url\)/);
  assert.match(post, /response\.cookies\.set\(PLATFORM_ADMIN_BUSINESS_COOKIE, businessId/);
  assert.match(post, /sameSite: "lax"/);
  assert.match(post, /secure: process\.env\.NODE_ENV === "production"/);
  assert.match(post, /httpOnly: false/); // El cliente SSR y el navegador comparten selección explícita.
  assert.match(post, /"Cache-Control": "no-store"/);
  assert.ok(post.indexOf("await requirePlatformAdminContext()") < post.indexOf("response.cookies.set("));
});

test("GET y enlaces prefetched no cambian la selección ni crean privilegios tenant", () => {
  const get = route.split("export async function GET")[1] ?? "";
  assert.match(get, /status: 303/);
  assert.match(get, /Location: "\/admin-global"/);
  assert.doesNotMatch(get, /response\.cookies\.set|PLATFORM_ADMIN_BUSINESS_COOKIE/);
  assert.match(server, /PLATFORM_ADMIN_BUSINESS_HEADER/);
  assert.match(scopeMigration, /auth\.uid\(\) is null or not public\.is_platform_admin\(\)/);
  assert.match(scopeMigration, /v_headers ->> 'x-platform-business-id'/);
  assert.match(scopeMigration, /join public\.businesses b on b\.id = v_selected_business_id/);
});

test("IDs UUID inválidos no se usan como ámbito de acceso", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(validPlatformBusinessId(id), id);
  for (const value of ["otro-negocio", "/admin-global", "1' OR true--", "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", ""]) {
    assert.equal(validPlatformBusinessId(value), null);
  }
});

test("pantalla de acceso restringido ofrece recuperación solo si la sesión global sigue autorizada", () => {
  assert.match(accessDenied, /export const dynamic = "force-dynamic"/);
  assert.match(accessDenied, /await getPlatformAdminContext\(\)/);
  assert.match(accessDenied, /isPlatformAdmin \? <Link className="button button--primary" href="\/admin-global"/);
  assert.match(accessDenied, /no se completó la selección del negocio/);
  assert.match(accessDenied, /<AdminLogoutButton \/>/);
  assert.match(accessDenied, /auth-page auth-page--caxas/);
});
