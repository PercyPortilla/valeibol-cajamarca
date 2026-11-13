import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const premium = readFileSync("app/styles/caxas-premium-2026.css", "utf8");
const mobile = readFileSync("app/styles/caxas-mobile-forms-2026.css", "utf8");
const globals = readFileSync("app/globals.css", "utf8");
const home = readFileSync("components/platform/HomeHero.tsx", "utf8");
const child = readFileSync("components/platform/BusinessSiteHeader.tsx", "utf8");

test("el buscador de la página madre usa una columna móvil incluso bajo 375 px", () => {
  const mobileBlock = premium.slice(premium.indexOf("@media (max-width: 680px)"));
  assert.match(mobileBlock, /\.platform-home \.platform-home-search\s*\{\s*grid-template-columns: minmax\(0,1fr\)/);
  assert.doesNotMatch(mobileBlock, /\.platform-home \.platform-home-search\s*\{\s*grid-template-columns: repeat\(2/);
  assert.match(mobile, /\.platform-home \.platform-home-search,\s*\.platform-search-page \.platform-search-form,\s*\.platform-sport-landing \.platform-search-form/);
  assert.match(mobile, /font-size: 16px/);
  assert.match(mobile, /grid-template-columns: minmax\(0,1fr\)/);
});

test("los inputs y los CTA de madre e hijas se acotan al ancho de su celda", () => {
  assert.match(mobile, /\.platform-home \.platform-home-search :is\(input,select\)/);
  assert.match(mobile, /\.platform-search-page \.platform-search-form :is\(input,select\)/);
  assert.match(mobile, /\.platform-sport-landing \.platform-search-form :is\(input,select\)/);
  assert.match(mobile, /min-width: 0;\s*width: 100%;\s*max-width: 100%;\s*box-sizing: border-box;/);
  assert.match(mobile, /\.business-site-header__nav\.business-site-header__primary|\.business-site-header__nav \.business-site-header__primary/);
  assert.match(mobile, /\.business-site-header__nav\s*\{\s*display: grid;\s*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.ok(globals.trimEnd().endsWith('@import "./styles/caxas-mobile-forms-2026.css";'));
});

test("la corrección visual preserva selección, datos y navegación originales", () => {
  assert.match(home, /name="fecha" type="date"/);
  assert.match(home, /name="hora" type="time"/);
  assert.match(home, /name="deporte" value=\{sportSlug\}/);
  assert.match(home, /action="\/buscar" method="get"/);
  assert.match(child, /business-site-header__nav/);
  assert.match(child, /encodeURIComponent\(businessSlug\)/);
  assert.doesNotMatch(mobile, /display: none/);
  assert.doesNotMatch(mobile, /overflow-x: hidden/);
});
