import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const search = readFileSync("app/buscar/page.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B82 reemplaza el search hero azul por la experiencia premium", () => {
  assert.match(search, /platform-page platform-search-page/);
  assert.match(search, /<PlatformHeader premium \/>/);
  assert.match(search, /platform-search-page__hero/);
  assert.doesNotMatch(search, /platform-hero platform-hero--compact/);
});

test("B82 conserva filtros y panorama contextual sin tocar catálogo", () => {
  assert.match(search, /getPublicPlatformCatalog/);
  assert.match(search, /getHomeSportTheme\(sport\)/);
  assert.match(search, /<SportLandingVisual sportSlug=\{sport\} \/>/);
  assert.match(search, /<PlatformSearchForm sport=\{sport\} city=\{city\} date=\{date\} time=\{time\} \/>/);
  assert.match(search, /<PlatformLocationExplorer points=\{locations\} \/>/);
  assert.match(search, /<PlatformResults businesses=\{businesses\} premium lightingRequired=\{lightingRequired\} \/>/);
});

test("B82 mantiene SEO y filtros activos existentes", () => {
  assert.match(search, /const hasFilters = Boolean\(sport \|\| date \|\| time\)/);
  assert.match(search, /robots: hasFilters \?/);
  assert.match(search, /buildBreadcrumbJsonLd/);
  assert.match(search, /platform-active-filters/);
});

test("B82 aplica tema oscuro al mapa resultados y responsive", () => {
  assert.match(css, /\/\* B82 · búsqueda premium continua desde el Hero \*\//);
  assert.match(css, /\.platform-search-page \.platform-location-explorer/);
  assert.match(css, /\.platform-search-page \.platform-active-filters/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-search-page__hero/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-search-page/);
});

test("B82 queda registrado como bloque", () => {
  assert.match(completeness, /platform-premium-search-page\.test\.ts/);
  assert.match(completeness, /BLOCK82_PROMPT\.md/);
});
