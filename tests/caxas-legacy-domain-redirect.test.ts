import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("el sitio público antiguo redirige al dominio SportCenter Caxas", () => {
  const config = readFileSync("next.config.mjs", "utf8");
  assert.match(config, /type: "host", value: "valeibol-cajamarca-live\.vercel\.app"/);
  assert.match(config, /https:\/\/caxas-sportcenter\.vercel\.app/);
  assert.match(config, /source: "\/"/);
  assert.match(config, /source: "\/:path\(\(\?!admin\/login\|admin\/activar\|auth\/callback\)\.\*\)"/);
  assert.match(config, /permanent: true/);
});
