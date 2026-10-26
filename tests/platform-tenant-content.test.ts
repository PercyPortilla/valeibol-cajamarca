import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const contentService = readFileSync("lib/data/publicSiteContentService.ts", "utf8");
const complexPage = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const actions = readFileSync("app/admin/(protected)/actions.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");

test("B29 carga contenido público por slug sin inyectar defaults de Valeibol en otros tenants", () => {
  assert.match(contentService, /getPublicSiteContent\(businessSlug: string = businessConfig\.slug\)/);
  assert.match(contentService, /p_business_slug: normalizedSlug/);
  assert.match(contentService, /const isLegacyBusiness = normalizedSlug === businessConfig\.slug/);
  assert.match(contentService, /const fallback = isLegacyBusiness \? defaultSiteContent\(\) : emptyTenantSiteContent\(\)/);
  assert.match(contentService, /services: \[\]/);
  assert.match(contentService, /gallery: \[\]/);
});

test("B29 publica servicios galería y paleta en la ficha genérica del mismo tenant", () => {
  assert.match(complexPage, /getPublicSiteContent\(business\.slug\)/);
  assert.match(complexPage, /siteContent\.services\.filter/);
  assert.match(complexPage, /siteContent\.gallery\.filter/);
  assert.match(complexPage, /className="platform-page site-theme"/);
  assert.match(complexPage, /themeCssVariables\(siteContent\.theme\)/);
  assert.match(complexPage, /platform-service-grid/);
  assert.match(complexPage, /platform-gallery-grid/);
  assert.match(complexPage, /if \(slug === businessConfig\.slug\)/);
  assert.match(complexPage, /<ValeibolLanding \/>/);
});

test("B29 invalida la ficha pública y búsqueda al guardar contenido tenant", () => {
  assert.match(actions, /revalidatePath\("\/buscar"\)/);
  assert.match(actions, /revalidatePath\("\/complejo\/\[slug\]", "page"\)/);
  assert.match(actions, /revalidatePath\("\/admin", "layout"\)/);
});

test("B29 adapta la identidad visual del tenant y mantiene responsive", () => {
  assert.match(styles, /\.platform-page\.site-theme[\s\S]*?--market-ink: var\(--brand-navy\)/);
  assert.match(styles, /--market-blue: var\(--brand-blue\)/);
  assert.match(styles, /--market-canvas: var\(--brand-canvas\)/);
  assert.match(styles, /\.platform-service-grid \{[^}]*grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.platform-gallery-grid \{[^}]*grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*?\.platform-service-grid,[\s\S]*?\.platform-gallery-grid \{ grid-template-columns: 1fr; \}/);
});
