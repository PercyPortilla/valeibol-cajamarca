import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261023235900_block15_platform_catalog_media.sql", "utf8");
const repository = readFileSync("lib/data/repositories/supabasePlatformRepository.ts", "utf8");
const businessCard = readFileSync("components/platform/BusinessCard.tsx", "utf8");
const platformHome = readFileSync("app/page.tsx", "utf8");
const nextConfig = readFileSync("next.config.mjs", "utf8");

test("B15 reutiliza la galería existente y expone solo una portada pública", () => {
  assert.match(migration, /left join public\.business_site_content site_content/i);
  assert.match(migration, /jsonb_array_elements\(coalesce\(site_content\.gallery/i);
  assert.match(migration, /lower\(coalesce\(item->>'isVisible', 'true'\)\) not in \('false', 'f', 'no', 'n', '0', 'off'\)/i);
  assert.match(migration, /\^\[0-9\]\{1,4\}\$/i);
  assert.match(migration, /limit 1/i);
  assert.match(migration, /cover_image_url text/i);
  assert.match(migration, /cover_alt_text text/i);
  assert.doesNotMatch(migration, /services jsonb|gallery jsonb|theme jsonb/i);
});

test("B15 conserva el RPC sanitizado y privilegios públicos acotados", () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public, pg_temp/i);
  assert.match(migration, /revoke all on function public\.get_public_platform_catalog\(text, text\) from public/i);
  assert.match(migration, /grant execute on function public\.get_public_platform_catalog\(text, text\) to anon, authenticated/i);
  assert.doesNotMatch(migration, /customer_phone|internal_note|created_by|email/i);
});

test("repositorio valida URLs antes de llevarlas a CSS y UI", () => {
  assert.match(repository, /function toPublicImageUrl/);
  assert.match(repository, /parsed\.protocol !== "https:"/);
  assert.match(repository, /parsed\.username \|\| parsed\.password/);
  assert.match(repository, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(repository, /\/storage\/v1\/object\/public\/business-gallery\//);
  assert.match(repository, /coverImageUrl: toPublicImageUrl\(row\.cover_image_url\)/);
});

test("cards usan cover real y el hero global no promociona un negocio", () => {
  assert.match(businessCard, /platform-business-card__visual--image/);
  assert.match(businessCard, /business\.coverAltText/);
  assert.match(businessCard, /import Image from "next\/image"/);
  assert.match(businessCard, /sizes="\(max-width: 680px\)/);
  assert.match(businessCard, /platform-business-card__court-lines/);
  assert.doesNotMatch(platformHome, /featuredBusiness/);
  assert.match(platformHome, /<HomeSportExperience/);
  assert.match(nextConfig, /\/storage\/v1\/object\/public\/business-gallery\/\*\*/);
});
