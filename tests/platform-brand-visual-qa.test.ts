import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const brand = readFileSync("components/brand/CaxasChromeBrand.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const violetCss = readFileSync("app/styles/caxas-chrome-violet-2026.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B64 mantiene branding de la madre y usa ahora el arte cromado aprobado", () => {
  assert.match(header, /premium \? \(/);
  assert.match(header, /<CaxasChromeBrand \/>/);
  assert.match(brand, /data-brand-asset="chrome-violet"/);
  assert.match(brand, /caxas-chrome-violet-wordmark\.webp/);
  assert.doesNotMatch(header, /caxas-sportcenter-logo\.webp/);
});

test("B64 conserva subtexto y responsive del nuevo wordmark", () => {
  assert.match(brand, /Plataforma deportiva · Cajamarca/);
  assert.match(css, /\.platform-header--premium \.platform-brand__wordmark/);
  assert.match(violetCss, /@media \(max-width: 680px\)[\s\S]*?\.caxas-chrome-brand__wordmark/);
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

