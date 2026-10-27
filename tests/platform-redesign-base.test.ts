import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const experience = readFileSync("components/platform/HomeSportExperience.tsx", "utf8");
const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 1 mantiene un único Hero al cambiar deporte", () => {
  assert.match(hero, /value=\{sportSlug\} onChange=\{\(event\) => onSportChange\(event\.target\.value\)\}/);
  assert.match(experience, /const \[sportSlug, setSportSlug\] = useState\(""\)/);
  assert.match(hero, /<SportComplexVisual[\s\S]*?theme=\{theme\}[\s\S]*?isNight=\{sceneNight\}/);
  assert.doesNotMatch(hero, /router\.push|window\.location|PlatformSearchForm|SportLandingPage/);
});

test("rediseño bloque 1 hace autosuficiente la estructura del Hero premium", () => {
  assert.match(css, /\.platform-home \.platform-home-hero--premium \{[\s\S]*?position:\s*relative;[\s\S]*?isolation:\s*isolate;/);
  assert.match(css, /\.platform-home \.platform-home-hero__grid \{[\s\S]*?display:\s*grid;/);
  assert.match(css, /\.platform-home \.platform-home-hero__aside \{[^}]*min-width:\s*0/);
});

test("rediseño bloque 1 conserva branding tipográfico sin isotipo", () => {
  assert.match(header, /data-brand-asset="wordmark-only"/);
  assert.match(header, /platform-brand__wordmark/);
  assert.doesNotMatch(header, /caxas-sportcenter-logo\.webp|next\/image/);
  assert.match(css, /platform-brand__wordmark/);
});

test("rediseño bloque 1 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-redesign-base\.test\.ts/);
  assert.match(completeness, /BLOCK65_PROMPT\.md/);
});
