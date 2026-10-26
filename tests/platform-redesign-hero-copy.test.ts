import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 3 usa el copy final solicitado", () => {
  assert.match(hero, /Encuentra dónde jugar <span>en Cajamarca<\/span>/);
  assert.match(hero, /Explora canchas, coliseos y espacios deportivos\. Compara horarios, disponibilidad y elige el lugar ideal para tu próximo partido\./);
  assert.match(hero, /Todo el deporte de Cajamarca, en una sola plataforma\./);
  assert.match(hero, /Explorar espacios/);
});

test("rediseño bloque 3 muestra Cajamarca como cobertura fija y no como selector", () => {
  assert.match(hero, /Cobertura actual:/);
  assert.match(hero, /platformConfig\.regionLabel/);
  assert.match(hero, /<small>Cobertura actual<\/small>/);
  assert.match(hero, /type="hidden" name="ciudad"/);
  assert.doesNotMatch(hero, /<select name="ciudad"/);
});

test("rediseño bloque 3 refuerza tipografía deportiva sin sacrificar responsive", () => {
  assert.match(css, /\.platform-home \.platform-home-hero__copy h1 \{[\s\S]*?font-style:\s*italic;[\s\S]*?font-weight:\s*950;/);
  assert.match(css, /font-size:\s*clamp\(48px,6\.7vw,84px\)/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-home-hero__copy h1/);
});

test("rediseño bloque 3 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-hero-copy\.test\.ts/);
  assert.match(completeness, /BLOCK67_PROMPT\.md/);
});
