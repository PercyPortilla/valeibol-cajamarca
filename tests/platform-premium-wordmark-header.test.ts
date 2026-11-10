import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const brand = readFileSync("components/brand/CaxasChromeBrand.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const violetCss = readFileSync("app/styles/caxas-chrome-violet-2026.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B85 preserva estructura premium y emplea el logotipo cromado autorizado", () => {
  assert.match(header, /<CaxasChromeBrand \/>/);
  assert.match(brand, /data-brand-asset="chrome-violet"/);
  assert.match(brand, /Plataforma deportiva · Cajamarca/);
  assert.doesNotMatch(header, /caxas-sportcenter-logo\.webp|emblem-fallback/);
});

test("B85 sigue mostrando metal en la tipografía complementaria", () => {
  assert.match(css, /B85 · Header \/ wordmark premium/);
  assert.match(violetCss, /\.caxas-chrome-brand__sport \{[\s\S]*?background-clip:\s*text/);
});

test("B85 mantiene navegación pública completa sin exigir cuenta", () => {
  for (const label of ["Explorar", "Deportes", "Complejos", "Consultar canchas"]) assert.match(header, new RegExp(label));
  assert.doesNotMatch(header, /href="\/mi-cuenta"/);
  assert.match(header, /aria-label="Navegación de la plataforma deportiva"/);
  assert.match(css, /platform-header--premium \.platform-nav a \{[\s\S]*?min-height:\s*44px/);
  assert.match(violetCss, /platform-header--premium \.platform-nav a:focus-visible[\s\S]*?outline:\s*3px solid #d2a7ff/);
});

test("B85 conserva identidad negra y plata sin volver al header blanco", () => {
  assert.match(css, /platform-header--premium \{[\s\S]*?background:[\s\S]*?#080a0c/);
  assert.match(violetCss, /caxas-chrome-brand__sport \{[\s\S]*?linear-gradient\(180deg,#ffffff[\s\S]*?#838397/);
  assert.doesNotMatch(css, /B85[\s\S]*?background:\s*(?:#fff|white)\s*;/);
});

test("B85 adapta branding y navegación móvil sin overflow", () => {
  assert.match(violetCss, /@media \(max-width: 680px\)[\s\S]*?caxas-chrome-brand__wordmark \{[^}]*width:/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-nav \{[\s\S]*?grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\)[\s\S]*?overflow:\s*visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-header--premium \.platform-nav a \{ transition:\s*none/);
});

test("B85 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-premium-wordmark-header\.test\.ts/);
  assert.match(completeness, /BLOCK85_PROMPT\.md/);
});
