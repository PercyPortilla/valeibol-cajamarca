import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MockPlatformRepository } from "../lib/data/repositories/mockPlatformRepository.ts";
import { buildBusinessDetail, groupCatalogByBusiness } from "../lib/data/repositories/platformRepository.ts";
import { buildBusinessJsonLd, buildMarketplaceJsonLd, serializeJsonLd } from "../lib/platform/seo.ts";

const searchPage = readFileSync("app/buscar/page.tsx", "utf8");
const complexPage = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const homePage = readFileSync("app/page.tsx", "utf8");
const sitemap = readFileSync("app/sitemap.ts", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");
const structuredData = readFileSync("components/platform/StructuredData.tsx", "utf8");
const footballPage = readFileSync("app/futbol/page.tsx", "utf8");
const reservationPage = readFileSync("app/reservar/page.tsx", "utf8");
const accountPage = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const ownerPage = readFileSync("app/propietario/page.tsx", "utf8");
const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");
const platformAdminPage = readFileSync("app/admin-global/page.tsx", "utf8");
const sportLanding = readFileSync("lib/platform/sportLanding.ts", "utf8");

test("B17 protege JSON-LD frente a cierre de script administrable", () => {
  const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
  assert.doesNotMatch(serialized, /<\/script>/i);
  assert.match(serialized, /\\u003c\/script>/i);
  assert.match(structuredData, /application\/ld\+json/);
});

test("home describe solo negocios visibles y no inventa reputación", async () => {
  const rows = await new MockPlatformRepository().listCatalog();
  const businesses = groupCatalogByBusiness(rows);
  const data = JSON.stringify(buildMarketplaceJsonLd(businesses));
  assert.match(data, /WebSite/);
  assert.match(data, /ItemList/);
  assert.doesNotMatch(data, /aggregateRating|reviewCount|ratingValue|Review/);
  assert.match(homePage, /buildMarketplaceJsonLd\(businesses\)/);
});

test("complejo publica SportsActivityLocation por sede sin inventar ratings ni horarios", async () => {
  const rows = await new MockPlatformRepository().listCatalog();
  const business = buildBusinessDetail(rows, "valeibol-cajamarca");
  assert.ok(business);
  const data = JSON.stringify(buildBusinessJsonLd(business));
  assert.match(data, /SportsActivityLocation/);
  assert.match(data, /PostalAddress/);
  assert.match(data, /BreadcrumbList/);
  assert.doesNotMatch(data, /aggregateRating|reviewCount|ratingValue|openingHours|telephone/);
  assert.match(complexPage, /buildBusinessJsonLd\(business\)/);
});

test("facetas de búsqueda son noindex y la base conserva canonical propio", () => {
  assert.match(searchPage, /const hasFilters = Boolean\(sport \|\| date \|\| time\)/);
  assert.match(searchPage, /robots: hasFilters \? \{ index: false, follow: true \} : \{ index: true, follow: true \}/);
  assert.match(searchPage, /hasFilters \? \{\} : \{ alternates: \{ canonical: "\/buscar" \} \}/);
  assert.match(searchPage, /buildBreadcrumbJsonLd/);
  assert.match(sitemap, /`\$\{siteUrl\}\/buscar`/);
  assert.doesNotMatch(sitemap, /buscar\?deporte|buscar\?ciudad/);
});

test("superficies transaccionales y privadas no compiten en el índice", () => {
  assert.match(reservationPage, /robots:\s*\{ index: false, follow: true \}/);
  assert.match(accountPage, /robots:\s*\{ index: false, follow: false \}/);
  assert.match(ownerPage, /robots:\s*\{ index: false, follow: false \}/);
  assert.match(adminLayout, /robots:\s*\{ index: false, follow: false \}/);
  assert.match(platformAdminPage, /robots:\s*\{ index: false, follow: false \}/);
});

test("landings deportivas solo se indexan y entran al sitemap con inventario real", () => {
  assert.match(footballPage, /buildSportLandingMetadata\("futbol", businesses\.length > 0\)/);
  assert.match(sportLanding, /robots: hasInventory \? \{ index: true, follow: true \} : \{ index: false, follow: true \}/);
  assert.match(sitemap, /getPublicSports\(\)/);
  assert.match(sitemap, /sports\.flatMap/);
  assert.match(sitemap, /sportSlugs\.has\(sport\.slug\)/);
});

test("metadataBase y URL pública se centralizan sin host de producción hardcodeado", () => {
  assert.match(layout, /resolveSiteUrl/);
  assert.match(layout, /metadataBase: new URL\(siteUrl \?\? "http:\/\/localhost:3000"\)/);
  const siteUrlSource = readFileSync("lib/platform/siteUrl.ts", "utf8");
  assert.match(siteUrlSource, /NEXT_PUBLIC_SITE_URL/);
  assert.match(siteUrlSource, /VERCEL_PROJECT_PRODUCTION_URL/);
  assert.doesNotMatch(siteUrlSource, /valeibol-cajamarca-live\.vercel\.app/);
});

test("breadcrumbs visibles mantienen semántica de lista y página actual", () => {
  assert.match(searchPage, /aria-label="Migas de pan"/);
  assert.match(searchPage, /<ol>/);
  assert.match(searchPage, /aria-current="page">Buscar canchas/);
  assert.match(complexPage, /aria-label="Migas de pan"/);
  assert.match(complexPage, /aria-current="page">\{business\.name\}/);
  const css = readFileSync("app/styles/globals-5.css", "utf8");
  assert.match(css, /\.platform-breadcrumbs a\s*\{[^}]*min-height:\s*44px[^}]*display:\s*inline-flex/i);
});
