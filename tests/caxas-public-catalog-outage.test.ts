import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const complex = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const booking = readFileSync("app/reservar/page.tsx", "utf8");
const unavailable = readFileSync("components/platform/PublicCatalogUnavailable.tsx", "utf8");
const service = readFileSync("lib/data/platformService.ts", "utf8");

test("una RPC fallida no se confunde con un complejo inexistente", () => {
  assert.match(service, /return \{ catalog: \[\], failed: true \}/);
  assert.match(complex, /getPublicPlatformCatalogResult\(\{ businessSlug: slug \}\)/);
  assert.match(complex, /if \(catalogResult\.failed\) \{/);
  assert.ok(complex.indexOf('kind="complex"') < complex.indexOf("if (!business) notFound()"));
  assert.match(complex, /robots: \{ index: false, follow: true \}/);
});

test("un error de catálogo no se convierte en 404 de la pizarra de reservas", () => {
  assert.match(booking, /getPublicPlatformCatalogResult\(\{ businessSlug \}\)/);
  assert.ok(booking.indexOf('kind="calendar"') < booking.indexOf("if (catalog.length === 0) notFound()"));
  assert.match(booking, /retryQuery\.set\("cancha", requestedCourtId\)/);
  assert.match(booking, /retryQuery\.set\("deporte", requestedSportSlug\)/);
});

test("el aviso no inventa datos de canchas, precios o disponibilidad", () => {
  assert.match(unavailable, /SERVICIO TEMPORALMENTE NO DISPONIBLE/);
  assert.match(unavailable, /Esto no significa que el complejo, sus canchas o sus reservas hayan desaparecido/);
  assert.match(unavailable, /no mostraremos datos de prueba/);
  assert.match(unavailable, /prefetch=\{false\}/);
  assert.doesNotMatch(unavailable, /mockPlatformRepository|MockPlatformRepository/);
});
