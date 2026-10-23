import assert from "node:assert/strict";
import test from "node:test";
import { MockPlatformRepository } from "../lib/data/repositories/mockPlatformRepository.ts";
import { groupCatalogByBusiness } from "../lib/data/repositories/platformRepository.ts";

test("catálogo fallback expone Valeibol como negocio de vóley", async () => {
  const rows = await new MockPlatformRepository().listCatalog({ sportSlug: "voley" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.businessSlug, "valeibol-cajamarca");
  assert.equal(rows[0]?.sportSlug, "voley");
});

test("filtro de fútbol no inventa resultados", async () => {
  const rows = await new MockPlatformRepository().listCatalog({ sportSlug: "futbol" });
  assert.deepEqual(rows, []);
});

test("agrupación de catálogo cuenta sedes/canchas sin duplicar negocio", async () => {
  const rows = await new MockPlatformRepository().listCatalog();
  const businesses = groupCatalogByBusiness([...rows, ...rows]);
  assert.equal(businesses.length, 1);
  assert.equal(businesses[0]?.venues, 1);
  assert.equal(businesses[0]?.courts, 1);
  assert.equal(businesses[0]?.priceFrom, 35);
});
