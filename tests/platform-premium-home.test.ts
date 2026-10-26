import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getHomeSportTheme, isNightSlot, sportTheme } from "../lib/platform/homeHeroTheme.ts";

const home = readFileSync("app/page.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const config = readFileSync("config/platform.ts", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B63 adopta Caxas SportCenter y limita el rediseño premium a la home", () => {
  assert.match(config, /name:\s*"Caxas SportCenter"/);
  assert.match(home, /<PlatformHeader premium \/>/);
  assert.match(header, /premium \? "Explorar" : "Buscar"/);
  assert.match(css, /\.platform-header--premium/);
  assert.match(css, /\.platform-home \{/);
});

test("B63 hero usa Cajamarca fija y no ofrece selector editable de ciudad", () => {
  assert.match(hero, /Encuentra dónde jugar/);
  assert.match(hero, /Todo el deporte de Cajamarca, en un solo lugar/);
  assert.match(hero, /Cobertura actual/);
  assert.match(hero, /platformConfig\.regionLabel/);
  assert.match(hero, /type="hidden" name="ciudad" value=\{platformConfig\.city\}/);
  assert.doesNotMatch(hero, /<select name="ciudad"/);
  assert.doesNotMatch(hero, /<input name="ciudad"[^>]*(?!type="hidden")/);
});

test("B63 mantiene deportes dinámicos y centraliza acentos sin condicionales repetidos", () => {
  assert.match(home, /sports=\{activeSports\}/);
  assert.match(hero, /sports\.map/);
  assert.equal(sportTheme.futbol.visual, "football");
  assert.equal(sportTheme.voley.visual, "volleyball");
  assert.equal(sportTheme.basquet.visual, "basketball");
  assert.equal(sportTheme.futsal.visual, "futsal");
  assert.equal(getHomeSportTheme("deporte-futuro").visual, "multi");
});

test("B63 deriva noche exclusivamente de la hora seleccionada", () => {
  assert.equal(isNightSlot("17:59"), false);
  assert.equal(isNightSlot("18:00"), true);
  assert.equal(isNightSlot("23:30"), true);
  assert.equal(isNightSlot("07:00"), false);
  assert.equal(isNightSlot(""), false);
  assert.equal(isNightSlot("25:00"), false);
  assert.match(hero, /const night = isNightSlot\(selectedTime\)/);
  assert.match(hero, /Horario con iluminación/);
  assert.doesNotMatch(hero, /new Date\(|Date\.now\(/);
});

test("B63 visual multicancha destaca deporte y enciende reflectores sin WebGL", () => {
  assert.match(visual, /data-active-sport=\{activeSport\}/);
  assert.match(visual, /data-court="football"/);
  assert.match(visual, /data-court="volleyball"/);
  assert.match(visual, /data-court="basketball"/);
  assert.match(visual, /data-court="futsal"/);
  assert.match(visual, /platform-sport-complex__roof/);
  assert.match(visual, /platform-sport-complex__lights/);
  assert.match(css, /\.platform-sport-complex\.is-night \.platform-sport-complex__lights span/);
  assert.doesNotMatch(visual, /three|webgl|canvas/i);
});

test("B63 conserva estadísticas reales, responsive y reduced motion", () => {
  assert.match(home, /businesses: allBusinesses\.length/);
  assert.match(home, /venues: venueCount/);
  assert.match(home, /courts: courtCount/);
  assert.match(hero, /stats\.businesses/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?platform-home-hero__grid \{ grid-template-columns: 1fr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-home \.platform-home-hero--premium/);
});

test("B63 queda registrado como artefacto obligatorio", () => {
  assert.match(completeness, /platform-premium-home\.test\.ts/);
  assert.match(completeness, /BLOCK63_PROMPT\.md/);
});

