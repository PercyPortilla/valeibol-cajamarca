import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B85 usa únicamente el wordmark tipográfico solicitado", () => {
  assert.match(header, /data-brand-asset="wordmark-only"/);
  assert.match(header, /platform-brand__wordmark">CAXAS <span>SPORTCENTER<\/span>/);
  assert.match(header, /Plataforma deportiva · Cajamarca/);
  assert.doesNotMatch(header, /caxas-sportcenter-logo\.webp|next\/image|emblem-fallback/);
});

test("B85 mantiene el wordmark metálico sin depender de imagen raster", () => {
  assert.match(css, /B85 · Header \/ wordmark premium/);
  assert.match(css, /platform-brand__wordmark \{[\s\S]*?linear-gradient\(180deg,#fff[\s\S]*?background-clip:\s*text/);
});

test("B85 mantiene navegación completa con targets accesibles", () => {
  for (const label of ["Explorar", "Deportes", "Complejos", "Mi cuenta"]) assert.match(header, new RegExp(label));
  assert.match(header, /aria-label="Navegación de la plataforma deportiva"/);
  assert.match(css, /platform-header--premium \.platform-nav a \{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /platform-header--premium \.platform-nav a:focus-visible \{[\s\S]*?outline:\s*3px solid #f4b740/);
});

test("B85 conserva identidad negra y plata sin volver al header blanco", () => {
  assert.match(css, /platform-header--premium \{[\s\S]*?background:[\s\S]*?#080a0c/);
  assert.match(css, /platform-brand__wordmark \{[\s\S]*?linear-gradient\(180deg,#fff[\s\S]*?#929aa1/);
  assert.doesNotMatch(css, /B85[\s\S]*?background:\s*(?:#fff|white)\s*;/);
});

test("B85 adapta branding y navegación móvil sin overflow", () => {
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-brand__wordmark \{[^}]*font-size:/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-nav \{[\s\S]*?grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\)[\s\S]*?overflow:\s*visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-header--premium \.platform-nav a \{ transition:\s*none/);
});

test("B85 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-premium-wordmark-header\.test\.ts/);
  assert.match(completeness, /BLOCK85_PROMPT\.md/);
});
