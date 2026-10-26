import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync("app/page.tsx", "utf8");
const experience = readFileSync("components/platform/HomeSportExperience.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B78 Home deja de navegar a las landings legacy al elegir deporte", () => {
  assert.doesNotMatch(home, /getSportLandingPath/);
  assert.doesNotMatch(experience, /href=\{getSportLandingPath|href="\/(?:voley|futbol|futsal|basquet)"/);
  assert.match(experience, /type="button"/);
  assert.match(experience, /onClick=\{\(\) => selectSport\(sport\.slug, true\)\}/);
});

test("B78 selector superior y tarjetas comparten un único sportSlug", () => {
  assert.match(experience, /const \[sportSlug, setSportSlug\] = useState\(""\)/);
  assert.match(experience, /<HomeHero[\s\S]*sportSlug=\{sportSlug\}[\s\S]*onSportChange=\{selectSport\}/);
  assert.match(hero, /sportSlug: string/);
  assert.match(hero, /onSportChange: \(sportSlug: string\) => void/);
  assert.match(hero, /value=\{sportSlug\}/);
  assert.match(hero, /onSportChange\(event\.target\.value\)/);
});

test("B78 selección desde las tarjetas devuelve la vista al Hero y respeta reduced motion", () => {
  assert.match(hero, /id="platform-home-hero"/);
  assert.match(experience, /getElementById\("platform-home-hero"\)/);
  assert.match(experience, /prefers-reduced-motion: reduce/);
  assert.match(experience, /scrollIntoView\(\{ behavior: reduceMotion \? "auto" : "smooth", block: "start" \}\)/);
});

test("B78 mantiene estado activo accesible en las tarjetas", () => {
  assert.match(experience, /aria-pressed=\{active\}/);
  assert.match(experience, /is-active/);
  assert.match(css, /\.platform-home \.platform-sport-card:focus-visible/);
  assert.match(css, /\.platform-home \.platform-sport-card\.is-active/);
});

test("B78 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-home-sport-selection\.test\.ts/);
  assert.match(completeness, /BLOCK78_PROMPT\.md/);
});
