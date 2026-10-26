import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sports } from "../config/sports.ts";

const home = readFileSync("app/page.tsx", "utf8");
const sitemap = readFileSync("app/sitemap.ts", "utf8");
const sportLanding = readFileSync("lib/platform/sportLanding.ts", "utf8");
const businessCard = readFileSync("components/platform/BusinessCard.tsx", "utf8");
const homeHero = readFileSync("components/platform/HomeHero.tsx", "utf8");

test("B19 da landing dedicada a los cuatro deportes activos del modelo", () => {
  const activeSlugs = sports.filter((sport) => sport.active).map((sport) => sport.slug);
  assert.deepEqual(activeSlugs, ["voley", "futbol", "futsal", "basquet"]);

  for (const slug of activeSlugs) {
    const source = readFileSync(`app/${slug}/page.tsx`, "utf8");
    assert.match(source, /SportLandingPage/);
    assert.match(source, /generateMetadata/);
    assert.match(source, new RegExp(`sportSlug="${slug}"`));
  }
  assert.match(sportLanding, /slug: "voley"/);
  assert.match(sportLanding, /slug: "futbol"/);
  assert.match(sportLanding, /slug: "futsal"/);
  assert.match(sportLanding, /slug: "basquet"/);
});

test("landings sin inventario real son noindex y no reciben canonical", () => {
  assert.match(sportLanding, /robots: hasInventory \? \{ index: true, follow: true \} : \{ index: false, follow: true \}/);
  assert.match(sportLanding, /hasInventory[\s\S]*alternates: \{ canonical: pathname \}/);
  assert.match(sportLanding, /hasInventory[\s\S]*openGraph:/);
});

test("home enlaza categorías a landings y muestra inventario derivado del catálogo", () => {
  assert.match(home, /getSportLandingPath\(sport\.slug\)/);
  assert.match(home, /sportCourtCounts/);
  assert.match(home, /sports=\{activeSports\}/);
  assert.match(homeHero, /sports\.map/);
  assert.match(home, /Sin oferta activa todavía/);
  assert.match(homeHero, /Encuentra dónde jugar/);
  assert.match(home, /id="complejos"/);
  assert.doesNotMatch(home, /featuredBusiness/);
  assert.doesNotMatch(home, /\|\| "Vóley · Fútbol"/);
  assert.doesNotMatch(home, /sport\.slug === "voley" \? "\/voley"/);
});

test("cards multi-deporte no ocultan silenciosamente la cuarta categoría", () => {
  assert.match(businessCard, /business\.sports\.length > 3/);
  assert.match(businessCard, /business\.sports\.length - 3/);
});

test("sitemap incluye landings deportivas solo cuando existe inventario", () => {
  assert.match(sitemap, /getPublicSports\(\)/);
  assert.match(sitemap, /sports\.flatMap/);
  assert.match(sitemap, /sportSlugs\.has\(sport\.slug\)/);
  assert.match(sitemap, /getSportLandingPath\(sport\.slug\)/);
});
