import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B83 prepara renders día y noche con una sola cámara y fallback arquitectónico", () => {
  assert.match(visual, /platform-sport-diorama__render-stack/);
  assert.match(visual, /data-render-camera="shared"/);
  assert.match(visual, /data-render-fallback="architectural-css"/);
  assert.match(css, /caxas-complex-day\.webp/);
  assert.match(css, /caxas-complex-night\.webp/);
  assert.match(css, /\.platform-sport-diorama__render--day\s*\{[\s\S]*?background-blend-mode:\s*screen/);
  assert.match(css, /platform-sport-diorama\.is-day[\s\S]*?render--day/);
  assert.match(css, /platform-sport-diorama\.is-night[\s\S]*?render--night/);

  const dayExists = existsSync("public/images/caxas-complex-day.webp");
  const nightExists = existsSync("public/images/caxas-complex-night.webp");
  assert.equal(dayExists, true, "el render premium diurno debe formar parte del release final");
  assert.equal(nightExists, true, "el render premium nocturno debe formar parte del release final");
  assert.ok(statSync("public/images/caxas-complex-day.webp").size > 4_000);
  assert.ok(statSync("public/images/caxas-complex-night.webp").size > 4_000);
});

test("B83 conserva la escena deportiva completa como fallback temporal", () => {
  for (const sport of ["football", "volleyball", "basketball", "futsal"]) {
    assert.match(visual, new RegExp(`data-sport="${sport}"`));
  }
  assert.match(visual, /platform-sport-diorama__stand/);
  assert.match(visual, /platform-sport-diorama__fence/);
  assert.match(visual, /platform-sport-diorama__building/);
  assert.match(visual, /platform-sport-diorama__lights/);
  assert.match(visual, /platform-sport-diorama__skyline/);
});

test("B83 mantiene pan y zoom de 720 ms para los cinco enfoques sin navegación ni remount", () => {
  assert.match(css, /platform-sport-diorama__render-stack[\s\S]*?transition:\s*transform \.72s/);
  assert.match(css, /platform-sport-diorama__camera[^}]*transition:\s*transform \.72s/);
  for (const sport of ["multi", "football", "volleyball", "basketball", "futsal"]) {
    assert.match(css, new RegExp(`data-camera-focus="${sport}"`));
  }
  assert.match(visual, /data-camera-focus=\{theme\.visual\}/);
  assert.doesNotMatch(hero, /key=\{theme\.visual\}|router\.push|window\.location/);
});

test("B83 conserva B80 y reduce la transición casi a cero cuando corresponde", () => {
  assert.match(hero, /isCajamarcaLightingTime\(new Date\(\)\)/);
  assert.match(hero, /<SportComplexVisual theme=\{theme\} isNight=\{sceneNight\} \/>/);
  assert.doesNotMatch(hero, /<SportComplexVisual theme=\{theme\} isNight=\{reservationNeedsLighting\}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-sport-diorama__render-stack[\s\S]*?transition-duration:\s*\.01ms !important/);
});

test("B83 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-definitive-sports-render\.test\.ts/);
  assert.match(completeness, /BLOCK83_PROMPT\.md/);
});
