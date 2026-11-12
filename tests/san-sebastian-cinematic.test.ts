import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const page = read("app/complejo/[slug]/page.tsx");
const scene = read("components/platform/SanSebastianCinematic.tsx");
const css = read("app/styles/san-sebastian-cinematic-2026.css");
const imports = read("app/globals.css");

test("experiencia cinematográfica exclusiva de la hija, no sustituye Valeibol ni la madre", () => {
  assert.match(page, /slug === businessConfig\.slug/);
  assert.match(page, /<ValeibolLanding \/>/);
  assert.match(page, /const isSanSebastian = business\.slug === "polideportivo-san-sebastian"/);
  assert.match(page, /isSanSebastian \? <SanSebastianCinematic/);
  assert.match(page, /<BusinessSiteHeader businessName=\{business\.name\}/);
  assert.match(page, /<BusinessSiteFooter businessName=\{business\.name\}/);
  assert.match(imports, /san-sebastian-cinematic-2026\.css/);
  assert.match(css, /\.ss-cinema-world/);
});

test("Campos 1 y 2 conservan identidad física, deportes, estado y agenda propia", () => {
  assert.match(page, /cinematicCourts = displayVenues\.flatMap/);
  assert.match(page, /id: court\.id/);
  assert.match(page, /sports: court\.sports/);
  assert.match(page, /bookable: court\.bookable/);
  assert.match(page, /priceText: court\.priceFrom === null \? null/);
  assert.match(scene, /encodeURIComponent\(activeCourt\.id\)/);
  assert.match(scene, /court\.sports\.map\(\(entry, sportIndex\)/);
  assert.match(scene, /"HORARIOS POR CONFIRMAR"/);
  assert.match(scene, /horarios y tarifas aún deben ser publicados/);
  assert.match(scene, /<Link className="ss-cinema-button ss-cinema-button--primary" href=\{reserveHref\}/);
  assert.doesNotMatch(scene, /insert|createReservation|bookImmediately/);
});

test("interacciones 3D, fútbol/vóley, scroll y accesibilidad respetan movimiento reducido", () => {
  assert.match(scene, /useState<"futbol" \| "voley">/);
  assert.match(scene, /aria-pressed=\{sport === option\.slug\}/);
  assert.match(scene, /aria-pressed=\{selected\}/);
  assert.match(scene, /IntersectionObserver/);
  assert.match(scene, /prefers-reduced-motion: reduce/);
  assert.match(css, /perspective: 1150px/);
  assert.match(css, /rotateY\(-22deg\)/);
  assert.match(css, /@keyframes ss-cinema-pitch-turn/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(scene, /Representación gráfica del deporte, no un plano de dimensiones reales/);
  assert.match(scene, /alt=\{coverAltText\}/);
});

test("conserva servicios, galería, ubicación, reseñas y contacto del negocio", () => {
  assert.match(page, /getPublicSiteContent/);
  assert.match(page, /getPublicBusinessShowcase/);
  assert.match(page, /googleMapsSearchHref\(displayVenues\[0\]\)/);
  assert.match(page, /contentSections\.get\(sectionId\)/);
  assert.match(page, /<PublicReviewsSection/);
  assert.match(scene, /id="canchas"/);
  assert.match(scene, /id="contacto"/);
  assert.match(scene, /mapHref/);
  assert.match(scene, /whatsappHref/);
});
