import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025034143_block27_dynamic_sports.sql", "utf8");
const service = readFileSync("lib/data/platformService.ts", "utf8");
const routes = readFileSync("lib/platform/routes.ts", "utf8");
const landing = readFileSync("lib/platform/sportLanding.ts", "utf8");
const dynamicPage = readFileSync("app/deportes/[slug]/page.tsx", "utf8");
const admin = readFileSync("components/platform-admin/PlatformAdminSportManagement.tsx", "utf8");
const adminPage = readFileSync("app/admin-global/page.tsx", "utf8");
const home = readFileSync("app/page.tsx", "utf8");
const search = readFileSync("components/platform/PlatformSearchForm.tsx", "utf8");
const sitemap = readFileSync("app/sitemap.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const css = readFileSync("app/styles/globals-5.css", "utf8");

test("B27 mantiene deportes globales bajo ADMIN explícito", () => {
  assert.match(migration, /get_platform_admin_sports\(\)[\s\S]*is_platform_admin\(\)/i);
  assert.match(migration, /platform_admin_upsert_sport[\s\S]*is_platform_admin\(\)/i);
  assert.match(migration, /platform_admin_set_sport_active[\s\S]*is_platform_admin\(\)/i);
  assert.match(migration, /sport_has_active_courts/i);
  assert.match(migration, /revoke insert, update, delete on public\.sports from anon, authenticated/i);
});

test("B27 expone al público solo deportes activos y sincroniza tipos", () => {
  assert.match(migration, /get_public_sports\(\)[\s\S]*where s\.is_active/i);
  assert.match(types, /get_public_sports:/);
  assert.match(types, /get_platform_admin_sports:/);
  assert.match(types, /platform_admin_upsert_sport:/);
  assert.match(types, /platform_admin_set_sport_active:/);
});

test("marketplace usa catálogo dinámico para home, búsqueda y sitemap", () => {
  assert.match(service, /getPublicSports/);
  assert.match(home, /Promise\.all\(\[getPublicPlatformCatalog\(\), getPublicSports\(\)\]\)/);
  assert.match(search, /await getPublicSports\(\)/);
  assert.match(sitemap, /getPublicSports\(\)/);
  assert.doesNotMatch(home, /sports\.filter\(\(sport\) => sport\.active\)/);
});

test("deportes nuevos obtienen landing dinámica sin romper rutas históricas", () => {
  assert.match(routes, /voley: platformRoutes\.volleyball/);
  assert.match(routes, /futbol: platformRoutes\.football/);
  assert.match(routes, /\/deportes\/\$\{encodeURIComponent\(slug\)\}/);
  assert.match(landing, /sportName\?\.trim\(\) \|\| slug/);
  assert.match(dynamicPage, /getPublicSportBySlug\(slug\)/);
  assert.match(dynamicPage, /<SportLandingPage sportSlug=\{sport\.slug\} \/>/);
});

test("ADMIN global puede crear editar y activar deportes sin SQL manual", () => {
  assert.match(adminPage, /get_platform_admin_sports/);
  assert.match(adminPage, /PlatformAdminSportManagement/);
  assert.match(admin, /platform_admin_upsert_sport/);
  assert.match(admin, /platform_admin_set_sport_active/);
  assert.match(admin, /Añadir deporte/);
  assert.match(admin, /sport_has_active_courts/);
  assert.match(css, /\.global-admin-sport-form[\s\S]*min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.global-admin-sport-form/);
});
