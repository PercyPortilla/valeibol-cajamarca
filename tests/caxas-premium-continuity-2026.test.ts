import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const text = (file: string) => readFileSync(file, "utf8");
const imports = text("app/globals.css");
const experienceCss = text("app/styles/caxas-experience-2026.css");
const tenantCss = text("app/styles/caxas-tenant-independence-2026.css");
const adminCss = text("app/styles/caxas-admin-command-2026.css");
const home = text("components/platform/HomeSportExperience.tsx");
const emblem = text("components/platform/SportEmblem.tsx");
const complex = text("app/complejo/[slug]/page.tsx");
const admin = text("app/admin-global/page.tsx");
const onboarding = text("components/platform-admin/PlatformAdminBusinessOnboarding.tsx");

test("las rutas internas comparten una experiencia premium con la portada", () => {
  assert.match(imports, /caxas-chrome-violet-2026\.css/);
  assert.match(imports, /caxas-experience-2026\.css/);
  assert.match(experienceCss, /\.platform-search-page__hero\s*\{/);
  assert.match(experienceCss, /\.platform-search-page \.platform-search-form \.button/);
  assert.match(experienceCss, /\.platform-sport-landing__hero\s*\{/);
  assert.match(experienceCss, /\.platform-sport-landing \.platform-search-form \.button/);
  assert.match(experienceCss, /\.platform-page \.platform-footer__inner/);
  assert.match(experienceCss, /#bd7aff/);
});

test("los iconos de vóley, fútbol, futsal y básquet son composiciones independientes", () => {
  assert.match(home, /<SportEmblem sportSlug=\{sport\.slug\}/);
  for (const slug of ["voley", "futbol", "futsal", "basquet"]) {
    assert.match(emblem, new RegExp(`sportSlug === "${slug}"`));
    assert.match(experienceCss, new RegExp(`platform-sport-card--${slug}`));
  }
  assert.doesNotMatch(emblem, /src="\/images\//);
});

test("la transición evita el fondo azul viejo y diferencia contexto de ruta", () => {
  const loading = text("app/loading.tsx");
  const adminLoading = text("app/admin/(protected)/loading.tsx");
  const tenantLoading = text("app/complejo/[slug]/loading.tsx");
  const routeLoading = text("components/ui/RouteLoading.tsx");
  assert.match(loading, /<RouteLoading \/>/);
  assert.match(adminLoading, /context="admin"/);
  assert.match(tenantLoading, /context="tenant"/);
  assert.match(routeLoading, /usePathname/);
  assert.match(routeLoading, /aria-busy="true"/);
  assert.match(experienceCss, /\.caxas-route-loading\s*\{/);
  assert.match(experienceCss, /\.caxas-route-loading--tenant/);
  assert.match(experienceCss, /prefers-reduced-motion: reduce/);
  assert.match(tenantCss, /body \{ background: #0a0910; \}/);
});

test("cada complejo usa sus colores editables, nunca violeta obligatorio en la ficha", () => {
  assert.match(complex, /data-tenant-brand=\{siteContent\.source === "default" \? "neutral" : "configured"\}/);
  assert.match(complex, /themeCssVariables\(siteContent\.theme\)/);
  assert.match(tenantCss, /\.platform-public-premium--complex\[data-tenant-brand="configured"\]/);
  assert.match(tenantCss, /--tenant-accent: var\(--brand-blue\)/);
  assert.match(tenantCss, /--tenant-accent: #b9c9d9/);
  assert.match(tenantCss, /\.site-theme--caxas-child \.site-nav--commercial \.site-nav__reserve/);
  assert.match(tenantCss, /background: var\(--brand-red\)/);
  assert.match(tenantCss, /\.site-theme--caxas-child \.hero-commercial__copy h1 span/);
  assert.doesNotMatch(tenantCss, /#bd7aff/);
});

test("comando global solo refleja agregados reales y conserva los permisos", () => {
  assert.match(admin, /requirePlatformAdminContext\(\)/);
  assert.match(admin, /client\.rpc\("get_platform_admin_summary"\)/);
  assert.match(admin, /client\.rpc\("get_platform_admin_sports"\)/);
  assert.match(admin, /const businessShare = totalBusinesses > 0/);
  assert.match(admin, /sportsByCourts\.map/);
  assert.match(admin, /No fue posible cargar los datos deportivos/);
  assert.match(admin, /no representa disponibilidad en tiempo real/);
  for (const anchor of ["admin-overview", "admin-negocios", "admin-deportes", "admin-resenas", "admin-alta-negocio"]) {
    assert.ok(admin.includes(`id="${anchor}"`));
  }
  assert.match(adminCss, /\.global-admin-command-grid/);
  assert.match(adminCss, /\.global-admin-metric__icon/);
});

test("el alta de negocio agrupa información sin perder campos ni seguridad", () => {
  for (const key of ["name", "slug", "ownerEmail", "city", "country", "address", "phone", "currency", "timezone"]) {
    assert.ok(onboarding.includes(`name="${key}"`), `No existe campo ${key}`);
  }
  assert.match(onboarding, /<form className="global-admin-onboarding__form" onSubmit=\{submit\}/);
  assert.match(onboarding, /invoc.*Onboarding|invokeOnboarding/);
  assert.match(onboarding, /El ADMIN global no obtiene acceso operativo al tenant/);
  assert.match(onboarding, /<fieldset className="global-admin-onboarding__group">/);
  assert.match(adminCss, /\.global-admin-onboarding__fields--three/);
});
