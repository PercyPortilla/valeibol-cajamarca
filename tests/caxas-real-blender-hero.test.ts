import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync("components/platform/HomeHero.tsx", "utf8");
const visual = readFileSync("components/platform/SportComplexVisual.tsx", "utf8");
const viewer = readFileSync("public/caxas-3d/index.html", "utf8");

test("B92 la portada usa el GLB real de Blender, no solo un diorama CSS", () => {
  assert.match(home, /<SportComplexVisual[\s\S]*?realModel/);
  assert.match(visual, /src="\/caxas-3d\/index\.html\?embed=1"/);
  assert.match(visual, /data-real-model=\{realModelReady/);
  assert.match(visual, /data\.type === "ready" && Number\(data\.meshCount\) > 0/);
});

test("B92 el puente de cámara y luz exige origen del mismo sitio", () => {
  assert.match(visual, /event\.origin !== window\.location\.origin/);
  assert.match(visual, /event\.source !== realFrameRef\.current\?\.contentWindow/);
  assert.match(viewer, /event\.origin !== window\.location\.origin/);
  assert.match(viewer, /event\.source !== window\.parent/);
  assert.match(viewer, /type: 'ready', meshCount/);
  assert.match(viewer, /focusSport\(data\.focus\)/);
});

test("B92 las cuatro canchas del complejo tienen nodos reales en el GLB", () => {
  const bytes = readFileSync("public/caxas-3d/assets/draco.glb");
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength));
  const names = new Set((json.nodes ?? []).map((node: { name?: string }) => node.name));
  for (const name of ["COURT_FUTBOL", "COURT_VOLEY", "COURT_FUTSAL", "COURT_BASQUET"]) {
    assert.ok(names.has(name), `No se encontró ${name} en el GLB`);
  }
  assert.ok((json.meshes ?? []).length >= 400);
});
