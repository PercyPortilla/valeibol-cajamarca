import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isNightSlot } from "../lib/platform/homeHeroTheme.ts";

const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 8 conserva la regla comercial de iluminación desde las 18:00", () => {
  assert.equal(isNightSlot("17:59"), false);
  assert.equal(isNightSlot("18:00"), true);
  assert.equal(isNightSlot("23:59"), true);
  assert.match(hero, /const reservationNeedsLighting = isNightSlot\(selectedTime\)/);
});

test("rediseño bloque 8 muestra indicador exacto sin precio inventado", () => {
  assert.match(hero, /reservationNeedsLighting \? "Con iluminación" : "Iluminación no requerida para este horario"/);
  assert.doesNotMatch(hero, /S\/\s*60|precio.*iluminación/i);
});

test("rediseño bloque 8 enciende reflectores y reflejos nocturnos", () => {
  assert.match(css, /\.platform-sport-diorama\.is-night \.platform-sport-diorama__lights > span i \{/);
  assert.match(css, /box-shadow:\s*0 0 7px #fff/);
  assert.match(css, /\.platform-sport-diorama\.is-night \.platform-sport-diorama__lights > span::before \{/);
  assert.match(css, /\.platform-sport-diorama\.is-night \.platform-sport-diorama__building i \{/);
  assert.match(css, /\.platform-sport-diorama\.is-night \.platform-sport-diorama__court \{/);
});

test("rediseño bloque 8 mantiene transición suave y reduced motion", () => {
  assert.match(css, /transition:\s*opacity \.35s ease,transform \.4s ease/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-sport-diorama__lights > span::before/);
});

test("rediseño bloque 8 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-night-lighting\.test\.ts/);
  assert.match(completeness, /BLOCK72_PROMPT\.md/);
});
