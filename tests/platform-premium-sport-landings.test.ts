import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const landing = readFileSync("components/platform/SportLandingPage.tsx", "utf8");
const visual = readFileSync("components/platform/SportLandingVisual.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B81 reemplaza header y hero legacy por la plantilla premium compartida", () => {
  assert.match(landing, /<PlatformHeader premium \/>/);
  assert.match(landing, /platform-sport-landing__hero/);
  assert.doesNotMatch(landing, /platform-hero platform-hero--sport/);
  assert.match(landing, /platform-sport-landing--\$\{sportSlug\}/);
});

test("B81 enfoca el panorama según el deporte de la URL y conserva iluminación real", () => {
  assert.match(landing, /<SportLandingVisual sportSlug=\{sportSlug\} \/>/);
  assert.match(visual, /getHomeSportTheme\(sportSlug\)/);
  assert.match(visual, /isCajamarcaLightingTime\(new Date\(\)\)/);
  assert.match(visual, /<SportComplexVisual theme=\{theme\} isNight=\{sceneNight\} \/>/);
});

test("B81 conserva buscador y resultados reales pero usa cards premium", () => {
  assert.match(landing, /<PlatformSearchForm sport=\{sportSlug\} \/>/);
  assert.match(landing, /<PlatformResults businesses=\{businesses\} premium \/>/);
  assert.match(landing, /businesses\.length/);
  assert.doesNotMatch(landing, /S\/\s*(?:35|60)|disponible hoy|últimos cupos/i);
});

test("B81 aplica metal negro plata, responsive, focus y reduced motion", () => {
  assert.match(css, /\/\* B81 · landings deportivas premium Caxas SportCenter \*\//);
  assert.match(css, /\.platform-sport-landing \{/);
  assert.match(css, /\.platform-sport-landing \.platform-search-form input:focus-visible/);
  assert.match(css, /@media \(max-width: 1080px\)[\s\S]*?platform-sport-landing__hero-grid/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-sport-landing__hero/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-sport-landing/);
});

test("B81 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-premium-sport-landings\.test\.ts/);
  assert.match(completeness, /BLOCK81_PROMPT\.md/);
});
