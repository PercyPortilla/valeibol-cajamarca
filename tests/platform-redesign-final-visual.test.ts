import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getHomeSportTheme } from "../lib/platform/homeHeroTheme.ts";

const home = readFileSync("app/page.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const experience = readFileSync("components/platform/HomeSportExperience.tsx", "utf8");
const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 13 mantiene identidad final Caxas negro plata en la home", () => {
  assert.match(home, /platform-page platform-home/);
  assert.match(hero, /CAXAS SPORTCENTER/);
  assert.match(header, /data-brand-asset="wordmark-only"/);
  assert.match(header, /platform-brand__wordmark">CAXAS <span>SPORTCENTER<\/span>/);
  assert.match(header, /platformConfig\.name/);
  assert.match(header, /Plataforma deportiva · Cajamarca/);
  assert.match(css, /\.platform-home \{[\s\S]*?--caxas-black:[\s\S]*?--caxas-silver:/);
  assert.match(css, /\.platform-home \.platform-business-card/);
});

test("rediseño bloque 13 ningún cambio de deporte monta el diseño viejo", () => {
  assert.doesNotMatch(hero, /PlatformSearchForm|platform-showcase-card|router\.push|window\.location/);
  assert.match(hero, /onSportChange\(event\.target\.value\)/);
  assert.match(experience, /setSportSlug\(nextSportSlug\)/);
  assert.match(hero, /<SportComplexVisual[\s\S]*?theme=\{theme\}[\s\S]*?isNight=\{sceneNight\}/);
  assert.match(visual, /platform-sport-diorama/);
  assert.doesNotMatch(visual, /platform-sport-complex__court|platform-showcase/);
});

test("rediseño bloque 13 resuelve todos los contextos deportivos principales", () => {
  const expected = {
    "": "multi",
    futbol: "football",
    voley: "volleyball",
    basquet: "basketball",
    futsal: "futsal",
  } as const;
  for (const [slug, scene] of Object.entries(expected)) {
    assert.equal(getHomeSportTheme(slug).visual, scene);
  }
});

test("rediseño bloque 13 conserva wordmark premium y noche", () => {
  assert.match(css, /platform-brand__wordmark/);
  assert.doesNotMatch(header, /caxas-sportcenter-logo\.webp|next\/image/);
  assert.match(css, /\.platform-sport-diorama\.is-night/);
  assert.match(css, /\.platform-sport-diorama\.is-night \.platform-sport-diorama__lights > span i/);
  assert.match(hero, /Con iluminación/);
  assert.match(hero, /Cajamarca/);
});

test("rediseño bloque 13 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-final-visual\.test\.ts/);
  assert.match(completeness, /BLOCK77_PROMPT\.md/);
});
