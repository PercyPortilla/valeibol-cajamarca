import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MockPlatformRepository } from "../lib/data/repositories/mockPlatformRepository.ts";
import { buildBusinessDetail } from "../lib/data/repositories/platformRepository.ts";
import { buildBusinessJsonLd } from "../lib/platform/seo.ts";

const repository = readFileSync("lib/data/repositories/platformRepository.ts", "utf8");
const complexPage = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const legacyLanding = readFileSync("components/site/ValeibolLanding.tsx", "utf8");
const header = readFileSync("components/site/Header.tsx", "utf8");
const footer = readFileSync("components/site/Footer.tsx", "utf8");
const brandLogo = readFileSync("components/brand/BrandLogo.tsx", "utf8");
const seo = readFileSync("lib/platform/seo.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");

test("B62 conserva logoUrl al construir la ficha pública del negocio", async () => {
  const rows = await new MockPlatformRepository().listCatalog();
  const business = buildBusinessDetail(rows, "valeibol-cajamarca");
  assert.ok(business);
  assert.equal(business.logoUrl, "/images/valeibol-logo.webp");
  assert.match(repository, /logoUrl: first\.logoUrl/);
});

test("B62 muestra logo tenant en ficha genérica y lo usa como fallback social", () => {
  assert.match(complexPage, /business\.logoUrl \? <span className="platform-complex-logo">/);
  assert.match(complexPage, /alt=\{`Logo de \$\{business\.name\}`\}/);
  assert.match(complexPage, /const socialImage = image \?\? logo/);
  assert.match(complexPage, /alt: image \? business\.coverAltText/);
  assert.match(styles, /\.platform-complex-logo \{/);
  assert.match(styles, /\.platform-complex-logo img \{/);
});

test("B62 landing Valeibol usa el logo configurado del catálogo en header y footer", () => {
  assert.match(legacyLanding, /const businessLogoUrl = catalog\[0\]\?\.logoUrl \?\? null/);
  assert.match(legacyLanding, /<Header logoUrl=\{businessLogoUrl\} \/>/);
  assert.match(legacyLanding, /<Footer logoUrl=\{businessLogoUrl\} \/>/);
  assert.match(header, /<BrandLogo logoUrl=\{logoUrl\} name=\{businessConfig\.name\} \/>/);
  assert.match(footer, /<BrandLogo context="footer" logoUrl=\{logoUrl\} name=\{businessConfig\.name\} \/>/);
  assert.match(brandLogo, /const src = logoUrl \|\| "\/images\/valeibol-logo\.webp"/);
});

test("B62 publica el logo del negocio en JSON-LD", async () => {
  const rows = await new MockPlatformRepository().listCatalog();
  const business = buildBusinessDetail(rows, "valeibol-cajamarca");
  assert.ok(business);
  const data = JSON.stringify(buildBusinessJsonLd({ ...business, logoUrl: "https://example.com/valeibol-logo.webp" }));
  assert.match(data, /"logo":/);
  assert.match(data, /valeibol-logo\.webp/);
  assert.match(seo, /\.\.\.\(logo \? \{ logo \} : \{\}\)/);
});

