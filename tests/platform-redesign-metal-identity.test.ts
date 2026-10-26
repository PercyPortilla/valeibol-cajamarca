import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync("app/styles/globals-5.css", "utf8");
const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 2 centraliza tokens metal negro y plata", () => {
  for (const token of [
    "--caxas-black",
    "--caxas-graphite",
    "--caxas-steel",
    "--caxas-steel-light",
    "--caxas-silver",
    "--caxas-silver-light",
    "--caxas-metal-border",
    "--caxas-metal-surface",
    "--caxas-metal-hover",
  ]) assert.match(css, new RegExp(token));
});

test("rediseño bloque 2 neutraliza azul heredado en superficies principales de la home", () => {
  assert.match(css, /\.platform-home \.platform-section__heading \.eyebrow/);
  assert.match(css, /\.platform-home \.badge--info/);
  assert.match(css, /\.platform-home \.platform-business-card > \.platform-favorite-button--icon/);
  assert.match(css, /\.platform-home \.platform-sport-card \{[^}]*var\(--caxas-metal-surface\)/);
  assert.match(css, /\.platform-home \.platform-business-card \{[^}]*var\(--caxas-metal-border\)/);
});

test("rediseño bloque 2 mantiene branding visible y navegación premium", () => {
  assert.match(hero, /CAXAS SPORTCENTER/);
  assert.match(header, /Plataforma deportiva · Cajamarca/);
  assert.match(header, /platform-header--premium/);
});

test("rediseño bloque 2 conserva focus accesible y reduced motion existentes", () => {
  assert.match(css, /\.platform-page a:focus-visible/);
  assert.match(css, /outline:\s*3px solid #f4b740/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("rediseño bloque 2 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-metal-identity\.test\.ts/);
  assert.match(completeness, /BLOCK66_PROMPT\.md/);
});
