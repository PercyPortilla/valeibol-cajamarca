import assert from "node:assert/strict";
import test from "node:test";
import { MockPlatformRepository } from "../lib/data/repositories/mockPlatformRepository.ts";
import { groupCatalogByBusiness } from "../lib/data/repositories/platformRepository.ts";

test("catálogo fallback expone Valeibol como negocio de vóley", async () => {
  const rows = await new MockPlatformRepository().listCatalog({ sportSlug: "voley" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.businessSlug, "valeibol-cajamarca");
  assert.equal(rows[0]?.sportSlug, "voley");
  assert.equal(rows[0]?.coverImageUrl, "/images/valeibol-court-wide.webp");
});

test("filtro de fútbol no inventa resultados", async () => {
  const rows = await new MockPlatformRepository().listCatalog({ sportSlug: "futbol" });
  assert.deepEqual(rows, []);
});

test("fallback no inventa inventario para futsal ni básquet", async () => {
  const repository = new MockPlatformRepository();
  assert.deepEqual(await repository.listCatalog({ sportSlug: "futsal" }), []);
  assert.deepEqual(await repository.listCatalog({ sportSlug: "basquet" }), []);
});

test("agrupación de catálogo cuenta sedes/canchas sin duplicar negocio", async () => {
  const rows = await new MockPlatformRepository().listCatalog();
  const businesses = groupCatalogByBusiness([...rows, ...rows]);
  assert.equal(businesses.length, 1);
  assert.equal(businesses[0]?.venues, 1);
  assert.equal(businesses[0]?.courts, 1);
  assert.equal(businesses[0]?.priceFrom, 35);
  assert.equal(businesses[0]?.coverImageUrl, "/images/valeibol-court-wide.webp");
});
