import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CAJAMARCA_TIME_ZONE, getCajamarcaClock, isCajamarcaLightingTime } from "../lib/platform/cajamarcaLighting.ts";

const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B80 usa America/Lima y enciende exactamente de 18:00 a 05:59", () => {
  assert.equal(CAJAMARCA_TIME_ZONE, "America/Lima");
  assert.deepEqual(getCajamarcaClock(new Date("2026-10-25T22:59:00Z")), { hour: 17, minute: 59 });
  assert.equal(isCajamarcaLightingTime(new Date("2026-10-25T22:59:00Z")), false);
  assert.equal(isCajamarcaLightingTime(new Date("2026-10-25T23:00:00Z")), true);
  assert.equal(isCajamarcaLightingTime(new Date("2026-10-26T10:59:00Z")), true);
  assert.equal(isCajamarcaLightingTime(new Date("2026-10-26T11:00:00Z")), false);
});

test("B80 separa iluminación visual real de la regla comercial del horario seleccionado", () => {
  assert.match(hero, /const reservationNeedsLighting = isNightSlot\(selectedTime\)/);
  assert.match(hero, /const \[sceneNight, setSceneNight\] = useState\(false\)/);
  assert.match(hero, /<SportComplexVisual[\s\S]*?theme=\{theme\}[\s\S]*?isNight=\{sceneNight\}/);
  assert.match(hero, /reservationNeedsLighting \? "Con iluminación"/);
  assert.doesNotMatch(hero, /<SportComplexVisual theme=\{theme\} isNight=\{reservationNeedsLighting\}/);
});

test("B80 actualiza la hora real mientras la página permanece abierta y al volver a la pestaña", () => {
  assert.match(hero, /isCajamarcaLightingTime\(new Date\(\)\)/);
  assert.match(hero, /window\.setInterval\(syncCajamarcaLighting, 15_000\)/);
  assert.match(hero, /visibilitychange/);
  assert.match(hero, /window\.addEventListener\("focus", syncCajamarcaLighting\)/);
  assert.match(hero, /window\.clearInterval\(intervalId\)/);
});

test("B80 reflectores se encienden escalonados y anuncian hora real de Cajamarca", () => {
  assert.match(visual, /Reflectores activos · hora real de Cajamarca/);
  assert.match(visual, /Día · iluminación natural/);
  assert.match(css, /--floodlight-delay:\s*\.56s/);
  assert.match(css, /@keyframes caxas-floodlight-beam-on/);
  assert.match(css, /@keyframes caxas-floodlight-lamp-on/);
  assert.match(css, /@keyframes caxas-window-warmup/);
});

test("B80 respeta reduced motion y queda registrado", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?caxas-window-warmup|animation:\s*none !important/);
  assert.match(completeness, /platform-real-time-cajamarca-lighting\.test\.ts/);
  assert.match(completeness, /BLOCK80_PROMPT\.md/);
});
