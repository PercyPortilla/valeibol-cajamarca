import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const hero = readFileSync("components/platform/HomeHero.tsx", "utf8");
const experience = readFileSync("components/platform/HomeSportExperience.tsx", "utf8");
const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const tenant = readFileSync("components/site/ValeibolLanding.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");

test("B91 define presets físicos para multi, fútbol, vóley, básquet y futsal", () => {
  for (const sport of ["multi", "football", "volleyball", "basketball", "futsal"]) {
    assert.match(css, new RegExp(`data-camera-focus="${sport}"`));
  }
  assert.match(css, /platform-sport-diorama__camera[^}]*transition:\s*transform \.72s/);
  assert.match(visual, /useEffect\(\(\) => \{[\s\S]*?setCamera\(INITIAL_CAMERA\)[\s\S]*?theme\.visual/);
  assert.match(visual, /showGeneralView/);
  assert.match(visual, /onSportChange\?\.\(""\)/);
});

test("B92 permite orbit, zoom, paneo y pinch con límites", () => {
  assert.match(visual, /handlePointerDown/);
  assert.match(visual, /handlePointerMove/);
  assert.match(visual, /handleWheel/);
  assert.match(visual, /event\.shiftKey \? "pan" : "orbit"/);
  assert.match(visual, /Math\.hypot\(b\.x - a\.x, b\.y - a\.y\)/);
  assert.match(visual, /zoom:\s*clamp[\s\S]*?\.82, 1\.42/);
  assert.match(visual, /panX:\s*clamp[\s\S]*?-86, 86/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(visual, /Restablecer cámara/);
});

test("B93 día y noche operan sobre la misma geometría y sin imágenes", () => {
  assert.match(hero, /isCajamarcaLightingTime\(new Date\(\)\)/);
  assert.match(visual, /isNight \? " is-night" : " is-day"/);
  assert.match(css, /platform-sport-diorama\.is-day/);
  assert.match(css, /platform-sport-diorama\.is-night/);
  assert.doesNotMatch(css, /caxas-complex-(?:day|night)\.webp/);
  assert.equal(existsSync("public/images/caxas-complex-day.webp"), false);
  assert.equal(existsSync("public/images/caxas-complex-night.webp"), false);
});

test("B94 las canchas son seleccionables y el hover no cambia estado por sí solo", () => {
  assert.match(visual, /data-sport-button="true"/);
  assert.match(visual, /aria-pressed=\{active\}/);
  assert.match(visual, /onClick=\{\(\) => selectSport\(visual\)\}/);
  assert.match(css, /platform-sport-diorama__court-zone:hover/);
  assert.match(css, /@keyframes caxas-tree-breeze/);
  assert.doesNotMatch(visual, /onMouseEnter=.*selectSport/);
});

test("B95 comparte sportSlug e inventario real con la escena", () => {
  assert.match(experience, /sportCourtCounts=\{sportCourtCounts\}/);
  assert.match(hero, /courtCounts=\{sportCourtCounts\}/);
  assert.match(hero, /onSportChange=\{onSportChange\}/);
  assert.match(visual, /countForVisual/);
  assert.match(visual, /data-offer-state/);
  assert.match(visual, /sin oferta activa todavía/);
  assert.match(experience, /Sin oferta activa todav/);
});

test("B96 mantiene Hero full-bleed y wordmark de texto, sin isotipo raster", () => {
  assert.match(css, /B84 · Hero full-bleed premium/);
  assert.match(css, /platform-home-hero__aside[\s\S]*?position:\s*absolute/);
  assert.match(header, /data-brand-asset="wordmark-only"/);
  assert.doesNotMatch(header, /next\/image|caxas-sportcenter-logo\.webp/);
  assert.doesNotMatch(css, /platform-brand__premium-logo/);
  assert.equal(existsSync("public/images/caxas-sportcenter-logo.webp"), false);
});

test("B97 el tenant Valeibol no monta la escena ni la carcasa de la madre", () => {
  assert.match(tenant, /className="site-theme"/);
  assert.doesNotMatch(tenant, /SportComplexVisual|platform-public-premium--tenant|platform-home/);
  assert.doesNotMatch(css, /platform-public-premium--tenant/);
});

test("B98 pausa animación fuera de viewport y respeta reduced motion", () => {
  assert.match(visual, /IntersectionObserver/);
  assert.match(visual, /observer\.disconnect\(\)/);
  assert.match(visual, /data-scene-visible=\{sceneVisible \? "true" : "false"\}/);
  assert.match(css, /data-scene-visible="false"[\s\S]*?animation-play-state:\s*paused/);
  assert.match(css, /contain:\s*layout paint style/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?caxas-tree-breeze|platform-sport-diorama__trees i \{ animation:\s*none !important/);
});
