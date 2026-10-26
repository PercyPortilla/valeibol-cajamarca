import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getHomeSportTheme, sportThemeConfig } from "../lib/platform/homeHeroTheme.ts";

const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 4 centraliza tema, icono y escena por deporte", () => {
  assert.equal(sportThemeConfig.futbol.visual, "football");
  assert.equal(sportThemeConfig.futbol.icon, "ball");
  assert.equal(sportThemeConfig.voley.visual, "volleyball");
  assert.equal(sportThemeConfig.voley.icon, "net");
  assert.equal(sportThemeConfig.basquet.visual, "basketball");
  assert.equal(sportThemeConfig.futsal.visual, "futsal");
  for (const slug of ["futbol", "voley", "basquet", "futsal"]) {
    assert.ok(sportThemeConfig[slug].accent.startsWith("#"));
    assert.ok(sportThemeConfig[slug].sceneLabel.length > 3);
  }
});

test("rediseño bloque 4 mantiene multi-deporte como fallback plata", () => {
  const fallback = getHomeSportTheme("deporte-desconocido");
  assert.equal(fallback.visual, "multi");
  assert.equal(fallback.label, "Multi-deporte");
  assert.equal(fallback.accent, "#E6E9EC");
});

test("rediseño bloque 4 cambia solo contexto del Hero y no la estructura", () => {
  assert.match(hero, /const theme = useMemo\(\(\) => getHomeSportTheme\(sportSlug\)/);
  assert.match(hero, /<Icon name=\{theme\.icon\}/);
  assert.match(hero, /<SportComplexVisual theme=\{theme\} isNight=\{sceneNight\} \/>/);
  assert.doesNotMatch(hero, /sportSlug\s*===/);
  assert.match(visual, /data-active-sport=\{theme\.visual\}/);
  assert.match(visual, /theme\.sceneLabel/);
});

test("rediseño bloque 4 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-sport-theme\.test\.ts/);
  assert.match(completeness, /BLOCK68_PROMPT\.md/);
});
