import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");

test("B88 elimina el render raster y deja una sola escena 3D persistente", () => {
  assert.match(visual, /data-render-engine="dom-css-3d"/);
  assert.match(visual, /data-scene-persistence="single"/);
  assert.match(visual, /data-render-fallback="architectural-dom"/);
  assert.doesNotMatch(visual, /render-stack|render--day|render--night|<img/i);
  assert.doesNotMatch(css, /caxas-complex-(?:day|night).webp|platform-sport-diorama__render-stack/);
  assert.equal(existsSync("public/images/caxas-complex-day.webp"), false);
  assert.equal(existsSync("public/images/caxas-complex-night.webp"), false);
});

test("B89 modela las cuatro zonas y equipamiento deportivo dentro de un único complejo", () => {
  for (const sport of ["football", "volleyball", "basketball", "futsal"]) {
    assert.match(visual, new RegExp(`court\\("${sport}"`));
  }
  assert.match(visual, /platform-sport-diorama__goal/);
  assert.match(visual, /platform-sport-diorama__net/);
  assert.match(visual, /platform-sport-diorama__hoop/);
  assert.match(visual, /platform-sport-diorama__parking/);
  assert.match(visual, /platform-sport-diorama__trees/);
  assert.match(visual, /platform-sport-diorama__social-zone/);
  assert.match(visual, /building--locker/);
});

test("B90 añade materiales arquitectónicos diferenciados sin fotografías gigantes", () => {
  assert.match(css, /B88–B90 · Escena arquitectónica 3D generada en tiempo real/);
  assert.match(css, /platform-sport-diorama__court--football[\s\S]*?#397e43/);
  assert.match(css, /platform-sport-diorama__court--volleyball[\s\S]*?#287aad/);
  assert.match(css, /platform-sport-diorama__court--basketball[\s\S]*?#bf6c3f/);
  assert.match(css, /platform-sport-diorama__court--futsal[\s\S]*?#217587/);
  assert.match(css, /platform-sport-diorama__ground[\s\S]*?repeating-linear-gradient/);
  assert.match(css, /platform-sport-diorama__building::after/);
});

test("B88-B90 mantienen estado de Hero sin remount y aíslan el render de la lógica comercial", () => {
  assert.doesNotMatch(hero, /key=\{theme\.visual\}|router\.push|window\.location/);
  assert.match(hero, /isCajamarcaLightingTime\(new Date\(\)\)/);
  assert.match(hero, /courtCounts=\{sportCourtCounts\}/);
  assert.match(hero, /onSportChange=\{onSportChange\}/);
  assert.doesNotMatch(hero, /isNight=\{reservationNeedsLighting\}/);
});
