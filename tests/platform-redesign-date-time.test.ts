import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isNightSlot } from "../lib/platform/homeHeroTheme.ts";
import { normalizeSearchDate, normalizeSearchTime } from "../lib/platform/searchFilters.ts";

const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const searchPage = readFileSync("app/buscar/page.tsx", "utf8");
const searchForm = readFileSync("components/platform/PlatformSearchForm.tsx", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 7 mantiene deporte fecha hora y CTA en el buscador principal", () => {
  assert.match(hero, /name="deporte"/);
  assert.match(hero, /name="fecha" type="date"/);
  assert.match(hero, /name="hora" type="time"/);
  assert.match(hero, /Explorar espacios/);
});

test("rediseño bloque 7 normaliza fecha y hora sin usar reloj del dispositivo", () => {
  assert.equal(normalizeSearchDate("2026-10-25"), "2026-10-25");
  assert.equal(normalizeSearchDate("2026-02-31"), "");
  assert.equal(normalizeSearchDate("25/10/2026"), "");
  assert.equal(normalizeSearchTime("17:59"), "17:59");
  assert.equal(normalizeSearchTime("18:00"), "18:00");
  assert.equal(normalizeSearchTime("24:00"), "");
  assert.equal(isNightSlot("17:59"), false);
  assert.equal(isNightSlot("18:00"), true);
});

test("rediseño bloque 7 conserva fecha y hora al llegar a buscar", () => {
  assert.match(searchPage, /normalizeSearchDate\(first\(params\.fecha\)\)/);
  assert.match(searchPage, /normalizeSearchTime\(first\(params\.hora\)\)/);
  assert.match(searchPage, /<PlatformSearchForm sport=\{sport\} city=\{city\} date=\{date\} time=\{time\} \/>/);
  assert.match(searchPage, /Fecha: <strong>\{date\}<\/strong>/);
  assert.match(searchPage, /Hora: <strong>\{time\}<\/strong>/);
  assert.match(searchForm, /defaultValue=\{date\}/);
  assert.match(searchForm, /defaultValue=\{time\}/);
});

test("rediseño bloque 7 no pretende filtrar disponibilidad desde catálogo", () => {
  assert.match(searchPage, /getPublicPlatformCatalog\(\{ sportSlug: sport \|\| null, city: city \|\| null \}\)/);
  assert.doesNotMatch(searchPage, /availability|pricing.*time/i);
});

test("rediseño bloque 7 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-date-time\.test\.ts/);
  assert.match(completeness, /BLOCK71_PROMPT\.md/);
});
