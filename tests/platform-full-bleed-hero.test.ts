import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B84 convierte el complejo en fondo full-bleed sin caja lateral", () => {
  assert.match(css, /B84 · Hero full-bleed premium/);
  assert.match(css, /platform-home-hero__aside \{[\s\S]*?position:\s*absolute[\s\S]*?left:\s*39%/);
  assert.match(css, /platform-home-hero__aside \.platform-sport-diorama \{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none/);
  assert.match(css, /platform-home-hero--premium::after[\s\S]*?linear-gradient\(90deg/);
  assert.match(css, /mask-image:\s*radial-gradient/);
});

test("B84 conserva copy buscador cobertura y CTA", () => {
  assert.match(hero, /Encuentra dónde jugar[\s\S]*en Cajamarca/);
  assert.match(hero, /Explora canchas, coliseos y espacios deportivos\. Compara horarios, disponibilidad y elige el lugar ideal para tu próximo partido\./);
  assert.match(hero, /Todo el deporte de Cajamarca, en una sola plataforma\./);
  assert.match(hero, /Cobertura actual/);
  assert.match(hero, /name="deporte"/);
  assert.match(hero, /name="fecha"/);
  assert.match(hero, /name="hora"/);
  assert.match(hero, /Explorar espacios/);
});

test("B84 integra deportes y estadísticas reales en el Hero", () => {
  assert.match(hero, /platform-home-hero__footer/);
  assert.match(hero, /platform-home-hero__sports/);
  assert.match(hero, /sports\.map/);
  assert.match(hero, /onClick=\{\(\) => onSportChange\(sport\.slug\)\}/);
  assert.match(hero, /aria-pressed=\{active\}/);
  assert.match(hero, /stats\.businesses/);
  assert.match(hero, /stats\.venues/);
  assert.match(hero, /stats\.courts/);
  assert.doesNotMatch(hero, />2<\/strong>/);
});

test("B84 mantiene B80-B83 y cámara persistente", () => {
  assert.match(hero, /isCajamarcaLightingTime\(new Date\(\)\)/);
  assert.match(hero, /<SportComplexVisual[\s\S]*?theme=\{theme\}[\s\S]*?isNight=\{sceneNight\}/);
  assert.doesNotMatch(hero, /key=\{theme\.visual\}|router\.push|window\.location/);
  assert.match(visual, /data-camera-focus=\{theme\.visual\}/);
  assert.match(visual, /data-render-engine="dom-css-3d"/);
  assert.doesNotMatch(visual, /caxas-complex-day|platform-sport-diorama__render--day/);
  assert.doesNotMatch(visual, /webgl|<canvas|three\.js|from "three"/i);
});

test("B84 respeta orden móvil targets foco y reduced motion", () => {
  assert.match(hero, /platform-home-hero__copy[\s\S]*?platform-home-search[\s\S]*?platform-home-hero__aside[\s\S]*?platform-home-hero__sports[\s\S]*?platform-market-stats/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?platform-home-hero__aside[\s\S]*?position:\s*relative/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-home-hero__sports \{ grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /platform-home-hero__sport \{[\s\S]*?min-height:\s*52px/);
  assert.match(css, /platform-home-hero__sport:focus-visible \{ outline:\s*3px solid #f4b740/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-home-hero__sport \{ transition:\s*none/);
});

test("B84 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-full-bleed-hero\.test\.ts/);
  assert.match(completeness, /BLOCK84_PROMPT\.md/);
});
