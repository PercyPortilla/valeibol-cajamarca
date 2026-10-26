import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("config/platform.ts", "utf8");
const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const home = readFileSync("app/page.tsx", "utf8");
const card = readFileSync("components/platform/BusinessCard.tsx", "utf8");
const editor = readFileSync("components/admin/AdminSiteContentEditor.tsx", "utf8");
const repository = readFileSync("lib/data/repositories/supabasePlatformRepository.ts", "utf8");
const siteRepository = readFileSync("lib/data/repositories/supabaseSiteContentRepository.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261025223000_block61_global_brand_business_logos.sql", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");
const completeness = readFileSync("scripts/validate-repository.mjs", "utf8");

test("B61 convierte SportCenter Caxas en marca madre sin negocio destacado en header", () => {
  assert.match(config, /name:\s*"SportCenter Caxas"/);
  assert.match(header, /href="\/#deportes">Deportes/);
  assert.match(header, /href="\/#complejos">Complejos/);
  assert.doesNotMatch(header, /href="\/voley"|href="\/futbol"|Valeibol Cajamarca/);
  assert.match(home, /id="deportes"/);
  assert.match(home, /id="complejos"/);
  assert.doesNotMatch(home, /featuredBusiness/);
  assert.match(home, /PLATAFORMA GENERAL/);
});

test("B61 muestra logo real del complejo y conserva fallback por inicial", () => {
  assert.match(card, /business\.logoUrl/);
  assert.match(card, /alt={`Logo de \$\{business\.name\}`}/);
  assert.match(card, /business\.name\.slice\(0, 1\)\.toUpperCase\(\)/);
  assert.match(repository, /logoUrl: toPublicImageUrl\(row\.logo_url\)/);
  assert.match(types, /get_public_platform_catalog:[\s\S]*logo_url: string \| null/);
});

test("B61 permite al tenant administrar su logo sin business_id del navegador", () => {
  assert.match(editor, /LOGO DEL NEGOCIO/);
  assert.match(editor, /uploadLogo/);
  assert.match(editor, /updateSiteContentAction\(\{ logoUrl/);
  assert.match(siteRepository, /p_logo_url: logoUrl \|\| null/);
  const adminFn = migration.match(/create function public\.admin_update_site_content[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(adminFn, /phase6_admin_actor\(\)/);
  assert.match(adminFn, /v_actor\.role not in \('owner', 'admin'\)/);
  assert.match(adminFn, /invalid_logo_url/);
  assert.doesNotMatch(adminFn, /p_business_id/);
});

test("B61 siembra logo Valeibol y repara nombres deportivos sin mojibake", () => {
  assert.match(migration, /valeibol-logo\.webp/);
  assert.match(migration, /when 'voley' then 'V' \|\| chr\(243\) \|\| 'ley'/);
  assert.match(migration, /when 'futbol' then 'F' \|\| chr\(250\) \|\| 'tbol'/);
  assert.match(migration, /when 'basquet' then 'B' \|\| chr\(225\) \|\| 'squet'/);
});

test("B61 registra migración, contrato SQL, test y prompt", () => {
  assert.match(runner, /platform_global_brand_business_logos\.sql/);
  assert.match(completeness, /20261025223000_block61_global_brand_business_logos\.sql/);
  assert.match(completeness, /platform-global-brand-logos\.test\.ts/);
  assert.match(completeness, /BLOCK61_PROMPT\.md/);
});
