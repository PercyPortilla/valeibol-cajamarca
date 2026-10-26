import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 6 mantiene una sola escena y cambia por atributos", () => {
  assert.match(hero, /<SportComplexVisual theme=\{theme\} isNight=\{night\} \/>/);
  assert.match(visual, /data-scene=\{theme\.visual\}/);
  assert.doesNotMatch(hero, /key=\{theme\.visual\}/);
});

test("rediseño bloque 6 usa transiciones ligeras de 200 a 500 ms", () => {
  const durations = [...css.matchAll(/\.(?:28|3|32|35|38|4|42|45)s\b/g)].map((match) => match[0]);
  assert.ok(durations.length >= 8);
  assert.match(css, /transition:\s*opacity \.28s ease/);
  assert.match(css, /transition:\s*opacity \.32s ease,transform \.38s ease/);
  assert.match(css, /transition:\s*transform \.4s ease/);
});

test("rediseño bloque 6 evita display none en equipamiento contextual", () => {
  const transitionRegion = css.slice(css.indexOf(".platform-sport-diorama__key"), css.indexOf(".platform-home .platform-market-stats"));
  assert.doesNotMatch(transitionRegion, /display:\s*none/);
  assert.match(transitionRegion, /opacity:\s*0;\s*visibility:\s*hidden/);
  assert.match(transitionRegion, /opacity:\s*1;\s*visibility:\s*visible/);
});

test("rediseño bloque 6 respeta reduced motion", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-sport-diorama__multi-grid/);
  assert.match(css, /platform-sport-diorama__goal/);
});

test("rediseño bloque 6 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-sport-transitions\.test\.ts/);
  assert.match(completeness, /BLOCK70_PROMPT\.md/);
});
