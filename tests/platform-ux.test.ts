import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const platformHeader = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const legacyHeader = readFileSync("components/site/Header.tsx", "utf8");
const legacyLanding = readFileSync("components/site/ValeibolLanding.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");

test("plataforma y Valeibol tienen enlace de salto accesible", () => {
  assert.match(platformHeader, /href="#platform-main"/);
  assert.match(legacyHeader, /href="#valeibol-main"/);
  assert.match(legacyLanding, /id="valeibol-main"/);
});

test("estilos globales incluyen foco visible y reduced motion", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*44px/);
});

test("navegación global tiene nombre accesible explícito", () => {
  assert.match(platformHeader, /aria-label="Navegación de la plataforma deportiva"/);
});
