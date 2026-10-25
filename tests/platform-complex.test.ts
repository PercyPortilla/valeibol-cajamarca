import assert from "node:assert/strict";
import test from "node:test";
import { MockPlatformRepository } from "../lib/data/repositories/mockPlatformRepository.ts";
import { buildBusinessDetail } from "../lib/data/repositories/platformRepository.ts";

test("detalle de complejo agrupa sede y cancha sin duplicados", async () => {
  const rows = await new MockPlatformRepository().listCatalog({ businessSlug: "valeibol-cajamarca" });
  const detail = buildBusinessDetail([...rows, ...rows], "valeibol-cajamarca");
  assert.ok(detail);
  assert.equal(detail.coverImageUrl, "/images/valeibol-court-wide.webp");
  assert.equal(detail.venues.length, 1);
  assert.equal(detail.venues[0]?.courts.length, 1);
  assert.equal(detail.venues[0]?.courts[0]?.sportSlug, "voley");
});

test("detalle inexistente devuelve null", () => {
  assert.equal(buildBusinessDetail([], "no-existe"), null);
});
