import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 5 reemplaza el wireframe por un diorama ligero", () => {
  assert.match(visual, /platform-sport-diorama/);
  assert.match(css, /perspective:\s*1000px/);
  assert.match(css, /rotateX\(57deg\) rotateZ\(-8deg\)/);
  assert.doesNotMatch(visual, /platform-sport-complex__court/);
  assert.doesNotMatch(visual, /three|webgl|canvas/i);
});

test("rediseño bloque 5 conserva equipamiento físico dentro del panorama B79", () => {
  assert.match(visual, /platform-sport-diorama__goal/);
  assert.match(visual, /platform-sport-diorama__net/);
  assert.match(visual, /platform-sport-diorama__hoop/);
  assert.match(visual, /platform-sport-diorama__fence/);
  assert.match(visual, /platform-sport-diorama__building/);
  assert.match(visual, /data-sport="football"[\s\S]*platform-sport-diorama__goal/);
  assert.match(visual, /data-sport="volleyball"[\s\S]*platform-sport-diorama__net/);
  assert.match(visual, /data-sport="basketball"[\s\S]*platform-sport-diorama__hoop/);
  assert.match(visual, /data-sport="futsal"[\s\S]*platform-sport-diorama__goal/);
});

test("rediseño bloque 5 mantiene escena multi-deporte y responsive tras B79", () => {
  assert.match(visual, /platform-sport-diorama__world/);
  assert.match(visual, /data-camera-focus=\{theme\.visual\}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?platform-sport-diorama \{ min-height: 440px/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-sport-diorama \{ min-height: 360px/);
});

test("rediseño bloque 5 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-sport-diorama\.test\.ts/);
  assert.match(completeness, /BLOCK69_PROMPT\.md/);
});
