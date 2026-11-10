import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");

test("la portada premium conserva búsqueda pública, visor 3D y diseño aislado", () => {
  const home = read("app/page.tsx");
  const hero = read("components/platform/HomeHero.tsx");
  const css = read("app/styles/caxas-premium-2026.css");
  assert.match(home, /<HomeSportExperience/);
  assert.match(hero, /<SportComplexVisual/);
  assert.match(hero, /action="\/buscar"/);
  assert.match(css, /\.platform-home \.platform-home-hero__grid/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(read("app/globals.css"), /caxas-premium-2026\.css/);
});

test("la información de disponibilidad y reflectores no se inventa", () => {
  const search = read("app/buscar/page.tsx");
  const business = read("components/platform/BusinessCard.tsx");
  const homeHero = read("components/platform/HomeHero.tsx");
  assert.match(search, /La fecha y hora son orientativas/);
  assert.match(search, /fecha y hora todavía no filtran la disponibilidad/);
  assert.match(business, /Consulta iluminación/);
  assert.match(homeHero, /Horario nocturno: consulta la iluminación de la cancha/);
  assert.doesNotMatch(homeHero, /Con iluminación/);
});

test("fallo de catálogo se distingue de lista vacía o filtros sin coincidencias", () => {
  const service = read("lib/data/platformService.ts");
  const results = read("components/platform/PlatformResults.tsx");
  const home = read("app/page.tsx");
  const search = read("app/buscar/page.tsx");
  assert.match(service, /getPublicPlatformCatalogResult/);
  assert.match(service, /failed: true/);
  assert.match(results, /if \(loadFailed\)/);
  assert.match(results, /ErrorState/);
  assert.match(results, /filtered \? "No hay complejos para este deporte"/);
  assert.match(home, /loadFailed=\{catalogResult\.failed\}/);
  assert.match(search, /loadFailed=\{catalogResult\.failed\}/);
});
