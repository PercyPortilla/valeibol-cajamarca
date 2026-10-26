import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B64 integra el logo oficial únicamente en el header premium de la página madre", () => {
  assert.match(header, /import Image from "next\/image"/);
  assert.match(header, /premium \? \(/);
  assert.match(header, /src="\/images\/caxas-sportcenter-logo\.webp"/);
  assert.match(header, /alt="Caxas SportCenter"/);
  assert.match(header, /platform-brand__premium-copy/);
});

test("B64 asset del logo es web-friendly y existe en public", () => {
  const path = "public/images/caxas-sportcenter-logo.webp";
  assert.equal(existsSync(path), true);
  assert.ok(statSync(path).size > 1_000);
  assert.ok(statSync(path).size < 100_000);
});

test("B64 conserva subtexto, responsive y contraste del header premium", () => {
  assert.match(header, /Plataforma deportiva · Cajamarca/);
  assert.match(css, /\.platform-header--premium \.platform-brand__premium-logo/);
  assert.match(css, /platform-brand__premium-logo img \{[^}]*object-fit:\s*contain/);
  assert.match(css, /@media \(max-width: 680px\)[\s\S]*?platform-brand__premium-logo/);
});

test("B64 QA garantiza que el deporte activo vence la regla de atenuación", () => {
  assert.match(css, /data-active-sport="football"\] \.platform-sport-complex__court\[data-court="football"\]/);
  assert.match(css, /data-active-sport="volleyball"\] \.platform-sport-complex__court\[data-court="volleyball"\]/);
  assert.match(css, /data-active-sport="basketball"\] \.platform-sport-complex__court\[data-court="basketball"\]/);
  assert.match(css, /data-active-sport="futsal"\] \.platform-sport-complex__court\[data-court="futsal"\]/);
});

test("B64 registra pruebas y prompt", () => {
  assert.match(completeness, /platform-brand-visual-qa\.test\.ts/);
  assert.match(completeness, /BLOCK64_PROMPT\.md/);
  assert.match(completeness, /caxas-sportcenter-logo\.webp/);
});

