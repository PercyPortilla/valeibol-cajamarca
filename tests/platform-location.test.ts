import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MockPlatformRepository } from "../lib/data/repositories/mockPlatformRepository.ts";
import { buildPlatformLocationPoints } from "../lib/data/repositories/platformRepository.ts";
import { googleMapsEmbedHref, googleMapsSearchHref, mapQuery } from "../lib/platform/maps.ts";

const searchPage = readFileSync("app/buscar/page.tsx", "utf8");
const explorer = readFileSync("components/platform/PlatformLocationExplorer.tsx", "utf8");
const complexPage = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");

test("B16 deduplica ubicaciones por sede sin inventar coordenadas", async () => {
  const rows = await new MockPlatformRepository().listCatalog();
  const points = buildPlatformLocationPoints([...rows, ...rows]);
  assert.equal(points.length, 1);
  assert.equal(points[0]?.venueId, rows[0]?.venueId);
  assert.equal(points[0]?.latitude, null);
  assert.equal(points[0]?.address, rows[0]?.venueAddress);
});

test("mapa usa coordenadas válidas y cae a dirección cuando faltan", () => {
  assert.equal(mapQuery({ latitude: -7.16, longitude: -78.51, address: "x", city: "Cajamarca" }), "-7.16,-78.51");
  assert.equal(mapQuery({ latitude: null, longitude: null, address: "Jr. Demo 123", city: "Cajamarca" }), "Jr. Demo 123, Cajamarca");
  assert.equal(mapQuery({ latitude: null, longitude: null, address: null, city: "Cajamarca" }), "");
  assert.equal(googleMapsEmbedHref({ latitude: null, longitude: null, address: null, city: "Cajamarca" }), null);
  assert.match(googleMapsSearchHref({ latitude: null, longitude: null, address: "Jr. Demo 123", city: "Cajamarca" }) ?? "", /^https:\/\/www\.google\.com\/maps\/search/);
  assert.match(googleMapsEmbedHref({ latitude: null, longitude: null, address: "Jr. Demo 123", city: "Cajamarca" }) ?? "", /output=embed$/);
});

test("/buscar integra un explorador geográfico único y accesible", () => {
  assert.match(searchPage, /buildPlatformLocationPoints\(catalog\)/);
  assert.match(searchPage, /<PlatformLocationExplorer points=\{locations\}/);
  assert.match(explorer, /aria-labelledby="platform-map-title"/);
  assert.match(explorer, /aria-pressed=\{active\}/);
  assert.match(explorer, /loading="lazy"/);
  assert.match(explorer, /referrerPolicy="no-referrer"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.platform-location-option:hover,[\s\S]*?transform:\s*none/i);
  assert.doesNotMatch(css, /\.platform-map-frame__card\s*\{[^}]*position:\s*absolute/i);
});

test("detalle de complejo ofrece ruta externa por sede", () => {
  assert.match(complexPage, /googleMapsSearchHref\(venue\)/);
  assert.match(complexPage, /Cómo llegar/);
  assert.match(complexPage, /rel="noreferrer"/);
});
