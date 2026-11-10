import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync("app/page.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const experience = readFileSync("components/platform/HomeSportExperience.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 10 mantiene estadísticas derivadas del catálogo", () => {
  assert.match(home, /businesses: allBusinesses\.length/);
  assert.match(home, /venues: venueCount/);
  assert.match(home, /courts: courtCount/);
  assert.match(hero, /stats\.businesses/);
  assert.match(hero, /stats\.venues/);
  assert.match(hero, /stats\.courts/);
  assert.doesNotMatch(hero, />2<\/strong>/);
});

test("rediseño bloque 10 explica explorar, conocer y coordinar por WhatsApp", () => {
  assert.match(experience, /<span>01<\/span><p><strong>Explora<\/strong><small>Elige el deporte y encuentra tu espacio\.<\/small>/);
  assert.match(experience, /<span>02<\/span><p><strong>Conoce<\/strong><small>Descubre canchas, precios y horarios\.<\/small>/);
  assert.match(experience, /<span>03<\/span><p><strong>Coordina<\/strong><small>Habla por WhatsApp con el complejo\.<\/small>/);
});

test("rediseño bloque 10 usa tarjetas estadísticas metálicas minimalistas", () => {
  assert.match(css, /\.platform-home \.platform-market-stats div \{[^}]*var\(--caxas-metal-border\)/);
  assert.match(css, /\.platform-home \.platform-market-stats strong \{[^}]*linear-gradient/);
  assert.match(css, /\.platform-home \.platform-market-stats span \{[^}]*letter-spacing:\s*\.1em/);
  assert.match(css, /\.platform-home \.platform-proof-strip__inner > div > span \{[^}]*linear-gradient/);
});

test("rediseño bloque 10 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-stats-flow\.test\.ts/);
  assert.match(completeness, /BLOCK74_PROMPT\.md/);
});
