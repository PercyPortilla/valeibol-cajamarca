import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeTenantAdminRedirectPath, tenantAdminEntryPath } from "../lib/auth/tenantAccess.ts";

const source = (file: string) => readFileSync(file, "utf8");

test("cada hijo tiene su propia entrada administrativa y el retorno de login es seguro", () => {
  const path = "/complejo/valeibol-cajamarca/administrar";
  assert.equal(tenantAdminEntryPath("valeibol-cajamarca"), path);
  assert.equal(safeTenantAdminRedirectPath(path), path);
  assert.equal(safeTenantAdminRedirectPath("//otro-sitio/administrar"), null);
  assert.equal(safeTenantAdminRedirectPath("/complejo/valeibol-cajamarca/administrar?next=https://evil.test"), null);
  assert.equal(safeTenantAdminRedirectPath("https://evil.test"), null);
  assert.equal(tenantAdminEntryPath("../admin-global"), null);
});

test("la página hija dispone de enlace específico sin enviar a la madre", () => {
  const footer = source("components/site/Footer.tsx");
  const tenantFooter = source("components/platform/PlatformFooter.tsx");
  const detail = source("app/complejo/[slug]/page.tsx");
  assert.match(footer, /\/complejo\/\$\{businessConfig\.slug\}\/administrar/);
  assert.match(tenantFooter, /businessSlug \? .*administrar/);
  assert.match(detail, /<PlatformFooter businessSlug=\{slug\}/);
});

test("el ingreso respeta el negocio solicitado y comprueba permisos en el servidor", () => {
  const login = source("app/admin/login/page.tsx");
  const form = source("components/admin/AdminLoginForm.tsx");
  const route = source("app/complejo/[slug]/administrar/route.ts");
  assert.match(login, /safeTenantAdminRedirectPath/);
  assert.match(form, /if \(tenantTarget\)/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /get_public_business_config/);
  assert.match(route, /get_platform_admin_context/);
  assert.match(route, /get_current_admin_context/);
  assert.match(route, /member\.business_id === businessId/);
  assert.match(route, /PLATFORM_ADMIN_BUSINESS_COOKIE/);
});

test("la madre muestra un acceso administrativo pequeño en el footer", () => {
  const home = source("app/page.tsx");
  const footer = source("components/platform/PlatformFooter.tsx");
  assert.doesNotMatch(home, /platform-home-owner/);
  assert.match(footer, /\/admin\/login\?next=%2Fadmin-global/);
  assert.match(footer, /Administración/);
});
