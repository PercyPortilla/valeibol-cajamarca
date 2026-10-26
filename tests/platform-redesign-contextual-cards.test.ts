import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync("app/page.tsx", "utf8");
const search = readFileSync("app/buscar/page.tsx", "utf8");
const results = readFileSync("components/platform/PlatformResults.tsx", "utf8");
const card = readFileSync("components/platform/BusinessCard.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 9 usa variante premium sin alterar datos de negocio", () => {
  assert.match(home, /<PlatformResults businesses=\{businesses\} premium \/>/);
  assert.match(results, /premium=\{premium\}/);
  assert.match(card, /platform-business-card--premium/);
  assert.match(card, /business\.priceFrom === null/);
  assert.match(card, /business\.venues/);
  assert.match(card, /business\.courts/);
  assert.match(card, /business\.reviewCount/);
});

test("rediseño bloque 9 deriva badge de iluminación de la hora validada", () => {
  assert.match(search, /const lightingRequired = Boolean\(time && isNightSlot\(time\)\)/);
  assert.match(search, /<PlatformResults businesses=\{businesses\} premium lightingRequired=\{lightingRequired\} \/>/);
  assert.match(card, /lightingRequired \? <span className="platform-lighting-badge">/);
  assert.match(card, /Con iluminación/);
});

test("rediseño bloque 9 no inventa precio ni disponibilidad contextual", () => {
  assert.doesNotMatch(card, /S\/\s*60|S\/\s*35/);
  assert.doesNotMatch(search, /availability.*=/i);
  assert.match(card, /formatMoney\(business\.priceFrom, business\.currency\)/);
});

test("rediseño bloque 9 aplica fondo grafito y borde metálico", () => {
  assert.match(css, /\.platform-business-card--premium \{[\s\S]*?background:\s*#12161a/);
  assert.match(css, /\.platform-business-card--premium \{[\s\S]*?border-color:\s*rgba\(191,197,203,.18\)/);
  assert.match(css, /\.platform-lighting-badge \{/);
});

test("rediseño bloque 9 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-contextual-cards\.test\.ts/);
  assert.match(completeness, /BLOCK73_PROMPT\.md/);
});
