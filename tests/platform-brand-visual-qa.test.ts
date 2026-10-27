import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B64 usa identidad tipográfica únicamente en el header premium de la página madre", () => {
  assert.match(header, /premium \? \(/);
  assert.match(header, /data-brand-asset="wordmark-only"/);
  assert.match(header, /platform-brand__wordmark">CAXAS <span>SPORTCENTER<\/span>/);
  assert.match(header, /platform-brand__premium-copy/);
  assert.doesNotMatch(header, /next\/image|caxas-sportcenter-logo\.webp|premium-logo/);
});

test("B64 conserva subtexto, responsive y contraste del header premium", () => {
  assert.match(header, /Plataforma deportiva · Cajamarca/);
  assert.match(css, /\.platform-header--premium \.platform-brand__wordmark/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-brand__wordmark/);
});

test("B64/B69 QA mantiene escenas deportivas diferenciadas", () => {
  assert.match(css, /data-scene="football"\].*--scene-surface:\s*#2d733d/);
  assert.match(css, /data-scene="volleyball"\].*--scene-surface:\s*#2d78a8/);
  assert.match(css, /data-scene="basketball"\].*--scene-surface:\s*#bc6538/);
  assert.match(css, /data-scene="futsal"\].*--scene-surface:\s*#176f7b/);
});

test("B64 registra pruebas y prompt", () => {
  assert.match(completeness, /platform-brand-visual-qa\.test\.ts/);
  assert.match(completeness, /BLOCK64_PROMPT\.md/);
});

