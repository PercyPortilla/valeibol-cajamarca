import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B79 mantiene las cuatro losas dentro de una sola escena panorámica", () => {
  for (const sport of ["football", "volleyball", "basketball", "futsal"]) {
    assert.match(visual, new RegExp(`court\\("${sport}"`));
  }
  assert.match(visual, /platform-sport-diorama__skyline/);
  assert.match(visual, /platform-sport-diorama__camera/);
  assert.match(visual, /platform-sport-diorama__world/);
  assert.doesNotMatch(visual, /platform-sport-diorama__multi-grid/);
});

test("B79 mueve la cámara sin remount al cambiar deporte", () => {
  assert.match(visual, /data-camera-focus=\{theme\.visual\}/);
  assert.doesNotMatch(hero, /key=\{theme\.visual\}/);
  assert.match(css, /--camera-x:/);
  assert.match(css, /--camera-y:/);
  assert.match(css, /--camera-scale:/);
  assert.match(css, /platform-sport-diorama__camera[^}]*transition:\s*transform \.72s/);
  for (const sport of ["football", "volleyball", "basketball", "futsal"]) {
    assert.match(css, new RegExp(`data-camera-focus="${sport}"`));
  }
});

test("B79 conserva equipamiento lógico por losa y enfatiza solo el deporte activo", () => {
  assert.match(visual, /court\("football"[\s\S]*?platform-sport-diorama__goal/);
  assert.match(visual, /court\("volleyball"[\s\S]*?platform-sport-diorama__net/);
  assert.match(visual, /court\("basketball"[\s\S]*?platform-sport-diorama__hoop/);
  assert.match(visual, /court\("futsal"[\s\S]*?platform-sport-diorama__goal/);
  assert.match(css, /not\(\[data-camera-focus="multi"\]\).*court-zone[^}]*opacity:\s*\.36/);
  assert.match(css, /court-zone--football[\s\S]*?opacity:\s*1/);
});

test("B79 adapta cámara a tablet y móvil y respeta reduced motion", () => {
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?platform-sport-diorama \{ min-height: 440px/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-sport-diorama \{ min-height: 360px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?platform-sport-diorama__camera/);
});

test("B79 queda registrado como bloque del proyecto", () => {
  assert.match(completeness, /platform-panoramic-sports-complex\.test\.ts/);
  assert.match(completeness, /BLOCK79_PROMPT\.md/);
});
