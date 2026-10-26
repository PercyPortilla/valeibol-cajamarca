import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025081018_block33_platform_admin_full_tenant_supervision.sql", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const login = readFileSync("app/admin/login/page.tsx", "utf8");
const logout = readFileSync("components/admin/AdminLogoutButton.tsx", "utf8");
const shell = readFileSync("components/admin/AdminShell.tsx", "utf8");
const media = readFileSync("app/api/admin/site-media/route.ts", "utf8");
const configuration = readFileSync("app/admin/(protected)/configuracion/page.tsx", "utf8");

test("B33 migra Storage de profiles directos a autorización tenant central", () => {
  for (const policy of ["business_gallery_admin_insert", "business_gallery_admin_update", "business_gallery_admin_delete"]) {
    const definition = migration.match(new RegExp(`create policy ${policy}[\\s\\S]*?;`, "i"))?.[0] ?? "";
    assert.match(definition, /public\.can_manage_business\(/i, policy);
    assert.doesNotMatch(definition, /public\.profiles/i, policy);
    assert.match(definition, /bucket_id = 'business-gallery'/i, policy);
  }
});

test("B33 valida el prefijo UUID de Storage antes de convertirlo", () => {
  assert.match(migration, /split_part\(name, '\/', 1\) ~\*/i);
  assert.match(migration, /then split_part\(name, '\/', 1\)::uuid/i);
  assert.match(migration, /else null/i);
});

test("upload de galería usa el businessId del contexto ya scoped", () => {
  assert.match(media, /const context = await getAdminContext\(\)/);
  assert.match(media, /context\.role !== "owner" && context\.role !== "admin"/);
  assert.match(media, /const path = `\$\{context\.businessId\}\/\$\{fileName\}`/);
  assert.doesNotMatch(media, /form\.get\("businessId"\)|searchParams\.get\("businessId"\)/);
});

test("ADMIN global vuelve a la administración principal y no queda atrapado en un tenant", () => {
  const platformIndex = login.indexOf("await getPlatformAdminContext()");
  const tenantIndex = login.indexOf("await getAdminContext()");
  assert.ok(platformIndex >= 0 && tenantIndex > platformIndex);
  assert.match(login, /sessionTarget = "\/admin-global"/);
  assert.match(logout, /PLATFORM_ADMIN_BUSINESS_COOKIE/);
  assert.match(logout, /Max-Age=0/);
  assert.match(shell, /Administración principal/);
});

test("proxy cubre admin-global y limpia el scope tenant al volver al panel principal", () => {
  assert.match(proxy, /platformAdminHome/);
  assert.match(proxy, /request\.cookies\.delete\(PLATFORM_ADMIN_BUSINESS_COOKIE\)/);
  assert.match(proxy, /response\.cookies\.delete\(PLATFORM_ADMIN_BUSINESS_COOKIE\)/);
  assert.match(proxy, /"\/admin-global\/:path\*"/);
});

test("B33 no eleva ADMIN global a OWNER del tenant", () => {
  assert.match(configuration, /context\.role === "owner"[\s\S]*<AdminAccessManagement/);
  assert.doesNotMatch(migration, /insert into public\.profiles|update public\.profiles/i);
});
