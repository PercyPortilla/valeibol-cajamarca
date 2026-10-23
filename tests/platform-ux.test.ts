import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const platformHeader = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const legacyHeader = readFileSync("components/site/Header.tsx", "utf8");
const legacyLanding = readFileSync("components/site/ValeibolLanding.tsx", "utf8");
const platformHome = readFileSync("app/page.tsx", "utf8");
const complexPage = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const sitemap = readFileSync("app/sitemap.ts", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const adminShell = readFileSync("components/admin/AdminShell.tsx", "utf8");
const adminResponsiveCss = readFileSync("app/styles/globals-2.css", "utf8");
const previewValidator = readFileSync("scripts/validate-preview-ui.mjs", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");

test("plataforma y Valeibol tienen enlace de salto accesible", () => {
  assert.match(platformHeader, /href="#platform-main"/);
  assert.match(legacyHeader, /href="#valeibol-main"/);
  assert.match(legacyLanding, /id="valeibol-main"/);
});

test("estilos globales incluyen foco visible y reduced motion", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /\.owner-portal__back \{[^}]*min-height:\s*44px/i);
  assert.match(css, /\.owner-portal__card a \{[^}]*min-height:\s*44px/i);
});

test("navegación global tiene nombre accesible explícito", () => {
  assert.match(platformHeader, /aria-label="Navegación de la plataforma deportiva"/);
});

test("Bloque 10 mantiene raíz global y Valeibol como tenant completo", () => {
  assert.match(platformHome, /PlatformSearchForm/);
  assert.match(platformHome, /COMPLEJOS/);
  assert.match(complexPage, /slug === businessConfig\.slug/);
  assert.match(complexPage, /return <ValeibolLanding \/>/);
  assert.match(legacyLanding, /AvailabilityCalendar/);
});

test("marca global vuelve al inicio y Valeibol se nombra como tenant", () => {
  assert.match(platformHeader, /className="platform-brand" href="\/" aria-label="Ir al inicio del marketplace deportivo"/);
  assert.match(platformHeader, />Valeibol Cajamarca<\/Link>/);
  assert.doesNotMatch(platformHeader, /Valeibol actual/);
  assert.match(css, /\.platform-brand \{[^}]*min-height:\s*44px/i);
});

test("metadata y sitemap representan marketplace multi-tenant", () => {
  assert.match(layout, /Canchas \| Reservas deportivas/);
  assert.match(complexPage, /getPublicPlatformCatalog\(\{ businessSlug: slug \}\)/);
  assert.match(complexPage, /business\.name/);
  assert.match(sitemap, /getPublicPlatformCatalog\(\)/);
  assert.match(sitemap, /groupCatalogByBusiness/);
  assert.match(sitemap, /complejo\/\$\{encodeURIComponent\(business\.slug\)\}/);
  assert.match(sitemap, /complejo\/valeibol-cajamarca/);
});

test("QA visual cubre navegación global y búsqueda responsive", () => {
  assert.match(previewValidator, /\.platform-brand/);
  assert.match(previewValidator, /\.platform-nav a/);
  assert.match(previewValidator, /\/buscar\?deporte=voley&ciudad=Cajamarca/);
  assert.match(previewValidator, /Buscar sin overflow/);
  assert.match(previewValidator, /Buscar Axe serious\/critical/);
});

test("admin móvil conserva marca, skip link y targets operativos de 44px", () => {
  assert.match(adminShell, /href="#admin-main">Saltar al contenido principal/);
  assert.match(adminShell, /className="admin-content" id="admin-main" tabIndex=\{-1\}/);
  assert.doesNotMatch(adminResponsiveCss, /\.brand--admin span:last-child \{ display: none; \}/);
  assert.match(adminResponsiveCss, /\.brand--admin > \.brand-logo \{ display: inline-flex; \}/);
  assert.match(adminResponsiveCss, /\.brand--admin \{[^}]*min-height:\s*44px/i);
  assert.match(css, /\.admin-shell \.admin-slot__quick-actions button,[\s\S]*?\.admin-shell \.admin-mini-action \{[\s\S]*?min-height:\s*44px/i);
  assert.match(css, /\.admin-reservation-filter \{[\s\S]*?min-height:\s*44px/i);
  assert.match(css, /\.admin-shell \.admin-nav-item,[\s\S]*?\.admin-shell \.admin-logout,[\s\S]*?\.admin-shell \.admin-exit,[\s\S]*?\.platform-nav a,[\s\S]*?min-height:\s*44px/i);
});
