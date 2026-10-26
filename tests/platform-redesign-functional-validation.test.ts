import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const home = readFileSync("app/page.tsx", "utf8");
const search = readFileSync("app/buscar/page.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("rediseño bloque 12 conserva scripts de validación técnica", () => {
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.match(pkg.scripts.qa, /validate-supabase-security\.mjs/);
  assert.match(pkg.scripts.qa, /validate-production-hardening\.mjs/);
  assert.match(pkg.scripts.qa, /validate-phase8\.mjs/);
  assert.match(pkg.scripts.qa, /npm test/);
});

test("rediseño bloque 12 mantiene rutas y superficies funcionales existentes", () => {
  assert.match(home, /<PlatformHeader premium \/>/);
  assert.match(home, /<PlatformResults businesses=\{businesses\} premium \/>/);
  assert.match(search, /getPublicPlatformCatalog/);
  assert.match(search, /<PlatformSearchForm/);
  assert.match(search, /<PlatformLocationExplorer/);
  assert.match(proxy, /\/admin/);
  assert.match(proxy, /\/admin-global/);
});

test("rediseño bloque 12 no añade backend paralelo", () => {
  assert.doesNotMatch(home, /fetch\(|\/api\//);
  assert.doesNotMatch(search, /createClient|supabase\.from|rpc\(/i);
});

test("rediseño bloque 12 registra test y prompt", () => {
  assert.match(completeness, /platform-redesign-functional-validation\.test\.ts/);
  assert.match(completeness, /BLOCK76_PROMPT\.md/);
});
