import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync("app/page.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
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

test("rediseño bloque 10 conserva copy final 01 Explora 02 Compara 03 Reserva", () => {
  assert.match(home, /<span>01<\/span><p><strong>Explora<\/strong><small>Encuentra espacios por deporte y horario\.<\/small>/);
  assert.match(home, /<span>02<\/span><p><strong>Compara<\/strong><small>Revisa complejos, canchas y disponibilidad\.<\/small>/);
  assert.match(home, /<span>03<\/span><p><strong>Reserva<\/strong><small>Gestiona tu reserva desde el complejo elegido\.<\/small>/);
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
