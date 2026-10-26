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
  assert.match(hero, /Todo el deporte de Cajamarca, en una sola plataforma/);
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

test("B63 conserva iluminación comercial por hora seleccionada tras separar escena real en B80", () => {
  assert.equal(isNightSlot("17:59"), false);
  assert.equal(isNightSlot("18:00"), true);
  assert.equal(isNightSlot("23:30"), true);
  assert.equal(isNightSlot("07:00"), false);
  assert.equal(isNightSlot(""), false);
  assert.equal(isNightSlot("25:00"), false);
  assert.match(hero, /const reservationNeedsLighting = isNightSlot\(selectedTime\)/);
  assert.match(hero, /Con iluminación/);
  assert.match(hero, /isCajamarcaLightingTime\(new Date\(\)\)/);
});

test("B63/B69 visual deportivo conserva escena contextual y reflectores tras B79 sin WebGL", () => {
  assert.match(visual, /data-active-sport=\{theme\.visual\}/);
  assert.match(visual, /data-scene=\{theme\.visual\}/);
  assert.match(visual, /data-camera-focus=\{theme\.visual\}/);
  assert.match(visual, /platform-sport-diorama__building/);
  assert.match(visual, /platform-sport-diorama__goal/);
  assert.match(visual, /platform-sport-diorama__net/);
  assert.match(visual, /platform-sport-diorama__hoop/);
  assert.match(visual, /platform-sport-diorama__world/);
  assert.match(visual, /platform-sport-diorama__court-zone--football/);
  assert.match(visual, /platform-sport-diorama__court-zone--volleyball/);
  assert.match(visual, /platform-sport-diorama__court-zone--basketball/);
  assert.match(visual, /platform-sport-diorama__court-zone--futsal/);
  assert.match(visual, /platform-sport-diorama__lights/);
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

