import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isAccessibleSiteTheme, normalizeSiteTheme, SITE_THEME_PRESETS } from "../lib/siteContent.ts";
import { isSameOriginPageBuilderMutation } from "../lib/platform/pageBuilderOrigin.ts";

const globalList = readFileSync("components/platform-admin/PlatformAdminBusinessList.tsx", "utf8");
const onboarding = readFileSync("components/platform-admin/PlatformAdminBusinessOnboarding.tsx", "utf8");
const globalPage = readFileSync("app/admin-global/page.tsx", "utf8");
const builderPage = readFileSync("app/admin-global/disenar/[businessId]/page.tsx", "utf8");
const studio = readFileSync("components/platform-admin/PageBuilderStudio.tsx", "utf8");
const scopedHelper = readFileSync("lib/platform/pageBuilder.ts", "utf8");
const saveRoute = readFileSync("app/api/admin-global/page-builder/[businessId]/route.ts", "utf8");
const mediaRoute = readFileSync("app/api/admin-global/page-builder/[businessId]/media/route.ts", "utf8");
const publicPage = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const tenantEditor = readFileSync("components/admin/AdminSiteContentEditor.tsx", "utf8");

test("la madre separa Diseñar página de Administrar negocio y conserva alta existente", () => {
  assert.match(globalList, /admin-global\/disenar/);
  assert.match(globalList, /Diseñar página/);
  assert.match(globalList, /<form action="\/api\/admin-global\/select-business" method="post"/);
  assert.match(globalList, /Administrar negocio/);
  assert.match(globalPage, /id="admin-alta-negocio"/);
  assert.match(globalPage, /PlatformAdminBusinessOnboarding/);
  assert.match(onboarding, /createdBusinessId/);
  assert.match(onboarding, /Diseñar ahora la página/);
});

test("estudio y endpoints exigen ADMIN global y scope exacto de Supabase", () => {
  assert.match(builderPage, /loadPageBuilder\(businessId\)/);
  assert.match(scopedHelper, /await getPlatformAdminContext\(\)/);
  assert.match(scopedHelper, /explicitPlatformBusinessId: businessId/);
  assert.match(scopedHelper, /get_current_admin_context/);
  assert.match(scopedHelper, /row\.business_id === businessId && row\.role === "admin"/);
  assert.match(saveRoute, /await getScopedPageBuilderClient\(businessId\)/);
  assert.match(saveRoute, /admin_update_site_content/);
  assert.match(saveRoute, /updated\.business_id !== businessId/);
  assert.doesNotMatch(saveRoute + mediaRoute, /service_role|SERVICE_ROLE|createAdminClient/);
  assert.match(mediaRoute, /getScopedPageBuilderClient\(businessId\)/);
});

test("editor tiene herramientas, vista móvil y guardado de contenido", () => {
  for (const label of ["Portada", "Secciones", "Imágenes", "Estilo", "Escritorio", "Móvil", "Guardar cambios", "vista previa"]) {
    assert.match(studio, new RegExp(label, "i"));
  }
  assert.match(studio, /fetch\(endpoint/);
  assert.match(studio, /\/media/);
  assert.match(studio, /theme\.pageHeadline/);
  assert.match(studio, /theme\.sectionOrder/);
  assert.match(studio, /isPublishedCandidate/);
  assert.match(studio, /Canchas y publicación/);
});

test("el JSON editorial mantiene colores válidos y límites seguros", () => {
  const base = SITE_THEME_PRESETS[0].theme;
  const theme = normalizeSiteTheme({ ...base, pageHeadline: "A".repeat(180), pageIntro: "B".repeat(300), sectionOrder: "gallery-first", servicesHeading: "Mis canchas", showGallery: false });
  assert.equal(theme.pageHeadline?.length, 100);
  assert.equal(theme.pageIntro?.length, 240);
  assert.equal(theme.sectionOrder, "gallery-first");
  assert.equal(theme.servicesHeading, "Mis canchas");
  assert.equal(theme.showGallery, false);
  assert.equal(theme.showServices, true);
  assert.equal(normalizeSiteTheme({ ...base, sectionOrder: "unknown" }).sectionOrder, "services-first");
  assert.equal(isAccessibleSiteTheme(theme), isAccessibleSiteTheme(base));
  assert.match(tenantEditor, /setTheme\(\(current\) => \(\{ \.\.\.current, \.\.\.preset\.theme \}\)\)/);
  assert.match(publicPage, /siteContent\.theme\.pageHeadline/);
  assert.match(publicPage, /siteContent\.theme\.pageIntro/);
  assert.match(publicPage, /siteContent\.theme\.sectionOrder/);
  assert.match(publicPage, /siteContent\.theme\.showServices/);
  assert.match(publicPage, /siteContent\.theme\.showGallery/);
});

test("mutaciones rechazan solicitudes de origen ajeno", () => {
  const url = "https://caxas-sportcenter.vercel.app/api/admin-global/page-builder/abc";
  const request = (origin: string, site: string) => new Request(url, {
    method: "POST",
    headers: { origin, host: "caxas-sportcenter.vercel.app", "sec-fetch-site": site },
  });
  assert.equal(isSameOriginPageBuilderMutation(request("https://caxas-sportcenter.vercel.app", "same-origin")), true);
  assert.equal(isSameOriginPageBuilderMutation(request("https://otro.example", "cross-site")), false);
  assert.equal(isSameOriginPageBuilderMutation(request("https://caxas-sportcenter.vercel.app", "cross-site")), false);
  assert.equal(isSameOriginPageBuilderMutation(new Request(url, { method: "POST" })), false);
  assert.match(saveRoute, /isSameOriginPageBuilderMutation/);
  assert.match(mediaRoute, /isSameOriginPageBuilderMutation/);
});
