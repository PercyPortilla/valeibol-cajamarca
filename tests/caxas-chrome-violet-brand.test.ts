import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const brand = readFileSync("components/brand/CaxasChromeBrand.tsx", "utf8");
const header = readFileSync("components/platform/PlatformHeader.tsx", "utf8");
const footer = readFileSync("components/platform/PlatformFooter.tsx", "utf8");
const adminBrand = readFileSync("components/brand/PlatformAdminBrand.tsx", "utf8");
const imports = readFileSync("app/globals.css", "utf8");
const homeCss = readFileSync("app/styles/caxas-premium-2026.css", "utf8");
const childCss = readFileSync("app/styles/caxas-children-premium-2026.css", "utf8");
const chromeCss = readFileSync("app/styles/caxas-chrome-violet-2026.css", "utf8");
const favicon = readFileSync("app/icon.svg", "utf8");
const sharedDioramaCss = readFileSync("app/styles/globals-5.css", "utf8");

test("marca aprobada cromo-violeta reutiliza arte real con tamaño y rutas válidos", () => {
  assert.ok(existsSync("public/images/caxas-chrome-violet-master.png"));
  assert.ok(existsSync("public/images/caxas-chrome-violet-wordmark.webp"));
  assert.ok(statSync("public/images/caxas-chrome-violet-wordmark.webp").size > 20_000);
  assert.match(brand, /src="\/images\/caxas-chrome-violet-wordmark\.webp"/);
  assert.match(brand, /width=\{2007\}[\s\S]*?height=\{298\}/);
  assert.match(brand, /alt="CAXAS"/);
  assert.match(brand, /SPORTCENTER/);
});

test("misma identidad en header, footer y contexto administrativo", () => {
  assert.match(header, /<CaxasChromeBrand \/>/);
  assert.match(footer, /<CaxasChromeBrand compact \/>/);
  assert.match(adminBrand, /<CaxasChromeBrand tagline=/);
  assert.match(favicon, /Caxas SportCenter/);
  assert.match(favicon, /#B44AFF/);
});

test("nueva capa corporativa tiene precedencia sobre estilos de las fases antiguas", () => {
  assert.match(imports, /caxas-children-premium-2026\.css";\s*@import "\.\/styles\/caxas-chrome-violet-2026\.css"/);
  assert.match(chromeCss, /\.caxas-chrome-brand__wordmark/);
  assert.match(chromeCss, /\.platform-page \.platform-header--premium \.platform-nav \.platform-nav__primary/);
  assert.match(chromeCss, /\.platform-header--premium \.platform-brand:focus-visible[\s\S]*?#d2a7ff/);
});

test("lima y verde grafito salen del diseño corporativo, sin alterar cesped ni estados operativos", () => {
  for (const css of [homeCss, childCss]) {
    assert.doesNotMatch(css, /#d9f675|#f0ffa8|#a2bb55|rgba\(217,246,117/);
    assert.match(css, /#bd7aff/);
  }
  assert.match(homeCss, /--premium-violet:\s*#bd7aff/);
  assert.match(childCss, /--caxas-accent:\s*#bd7aff/);
  assert.match(sharedDioramaCss, /platform-sport-diorama__mini--football[\s\S]*?#347e43/);
  assert.doesNotMatch(chromeCss, /\.admin-shell\s*\{\s*--brand-/);
});
