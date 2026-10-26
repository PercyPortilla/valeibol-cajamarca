import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/styles/globals-5.css", "utf8");
const validator = readFileSync("scripts/validate-preview-ui.mjs", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 11 conserva dos columnas grandes y una columna en tablet/móvil", () => {
  assert.match(css, /platform-home-hero__grid \{[\s\S]*?grid-template-columns:\s*minmax\(0,1\.06fr\) minmax\(420px,.94fr\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?platform-home-hero__grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-home-search \{ grid-template-columns: 1fr/);
});

test("rediseño bloque 11 mantiene panorama y logo proporcionados en móvil", () => {
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-sport-diorama \{ min-height: 360px; border-radius: 22px; \}/);
  assert.match(css, /platform-brand__premium-logo \{[\s\S]*?aspect-ratio:\s*3 \/ 2/);
  assert.match(css, /platform-brand__premium-logo img \{[^}]*object-fit:\s*contain/);
});

test("rediseño bloque 11 valida targets y secciones premium en QA reutilizable", () => {
  assert.match(validator, /\.platform-sport-diorama/);
  assert.match(validator, /\.platform-home-search input:not\(\[type='hidden'\]\)/);
  assert.match(validator, /rect\.width < 44 \|\| rect\.height < 44/);
  assert.match(css, /\.platform-nav a,[\s\S]*?min-height:\s*44px/);
});

test("rediseño bloque 11 conserva focus y reduced motion", () => {
  assert.match(css, /\.platform-page a:focus-visible/);
  assert.match(css, /outline:\s*3px solid #f4b740/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-sport-diorama__camera/);
});

test("rediseño bloque 11 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-responsive\.test\.ts/);
  assert.match(completeness, /BLOCK75_PROMPT\.md/);
});
