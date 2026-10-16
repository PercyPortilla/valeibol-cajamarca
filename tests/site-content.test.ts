import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SITE_GALLERY,
  DEFAULT_SITE_SERVICES,
  SITE_THEME_PRESETS,
  contrastRatio,
  isAccessibleSiteTheme,
  isValidSiteThemeInput,
  normalizeSiteGallery,
  normalizeSiteServices,
  normalizeSiteTheme,
  themeCssVariables,
} from "../lib/siteContent.ts";
import {
  LocalSiteContentRepository,
  resetLocalSiteContentForTests,
} from "../lib/data/repositories/localSiteContentRepository.ts";
import { readFile } from "node:fs/promises";

test("los servicios base incluyen todos los servicios confirmados por el negocio", () => {
  const titles = new Set(DEFAULT_SITE_SERVICES.map((item) => item.title));
  [
    "Cancha techada",
    "Reserva por hora",
    "Iluminación automática",
    "Zona de cooling break",
    "Música a elección",
    "Zona TV",
    "Tienda de bebidas y snacks",
    "Baños para hombres y mujeres",
    "Vestidores",
    "Zona para público",
    "Altura de malla a elección",
    "Balones profesionales",
  ].forEach((title) => assert.equal(titles.has(title), true, `Falta ${title}`));
});

test("normalización limita contenido y conserva orden/visibilidad", () => {
  const services = normalizeSiteServices([
    { id: "b", icon: "◷", title: "Segundo", description: "Servicio segundo", sortOrder: 20, isVisible: false },
    { id: "a", icon: "⌂", title: "Primero", description: "Servicio primero", sortOrder: 10, isVisible: true },
  ]);
  assert.deepEqual(services.map((item) => item.id), ["a", "b"]);
  assert.equal(services[1]?.isVisible, false);
  assert.deepEqual(services.map((item) => item.icon), ["court", "clock"]);
  assert.deepEqual(normalizeSiteServices([]), []);
  assert.deepEqual(normalizeSiteGallery(null), DEFAULT_SITE_GALLERY);
  assert.equal(normalizeSiteGallery([{ id: "x", title: "X", imageUrl: "javascript:alert(1)", altText: "X", sortOrder: 1, isVisible: true }])[0]?.imageUrl, "");
  assert.equal(normalizeSiteGallery([{ id: "local", title: "Local", imageUrl: "/uploads/local-gallery/foto.webp", altText: "Local", sortOrder: 1, isVisible: true }])[0]?.imageUrl, "/uploads/local-gallery/foto.webp");
  assert.equal(normalizeSiteGallery([{ id: "brand", title: "Cancha", imageUrl: "/images/valeibol-court-wide.webp", altText: "Cancha", sortOrder: 1, isVisible: true }])[0]?.imageUrl, "/images/valeibol-court-wide.webp");
});

test("paletas base cumplen contraste y colores inválidos vuelven a la base", () => {
  for (const preset of SITE_THEME_PRESETS) assert.equal(isAccessibleSiteTheme(preset.theme), true, preset.name);
  for (const preset of SITE_THEME_PRESETS) assert.equal(isValidSiteThemeInput(preset.theme), true, preset.name + " debe tener HEX válidos");
  const normalized = normalizeSiteTheme({ presetId: "custom", navy: "no", blue: "#155FA8", blueDark: "#0F4B88", red: "#B72F34", redDark: "#92252A", yellow: "#F4C430", canvas: "#F3F7FB" });
  assert.equal(normalized.navy, "#0C2B4A");
  assert.equal(isValidSiteThemeInput({ ...SITE_THEME_PRESETS[0].theme, navy: "#123" }), false);
});

test("la paleta genera tokens semánticos distintos para público y admin", () => {
  const classic = themeCssVariables(SITE_THEME_PRESETS[0].theme);
  const night = themeCssVariables(SITE_THEME_PRESETS[2].theme);
  assert.equal(night["--brand-text"], SITE_THEME_PRESETS[2].theme.navy);
  assert.equal(night["--brand-focus"], SITE_THEME_PRESETS[2].theme.blueDark);
  assert.notEqual(classic["--brand-surface-soft"], night["--brand-surface-soft"]);
  assert.notEqual(classic["--brand-blue-soft"], night["--brand-blue-soft"]);
  assert.notEqual(classic["--brand-border"], night["--brand-border"]);
  assert.ok(contrastRatio(night["--brand-muted"], SITE_THEME_PRESETS[2].theme.canvas) >= 4.5);
  const thresholdTheme = {
    ...SITE_THEME_PRESETS[0].theme,
    presetId: "custom" as const,
    navy: "#767676",
    canvas: "#FFFFFF",
  };
  const thresholdVars = themeCssVariables(thresholdTheme);
  assert.ok(contrastRatio(thresholdVars["--brand-muted"], thresholdTheme.canvas) >= 4.5);
});

test("el editor refresca el shell y la ruta pública después de guardar la paleta", async () => {
  const editor = await readFile("components/admin/AdminSiteContentEditor.tsx", "utf8");
  const actions = await readFile("app/admin/(protected)/actions.ts", "utf8");
  assert.match(editor, /router\.refresh\(\)/);
  assert.match(editor, /querySelector<HTMLElement>\("\.admin-shell"\)/);
  assert.match(actions, /revalidatePath\("\/admin", "layout"\)/);
  assert.match(actions, /revalidatePath\("\/"\)/);
});

test("repositorio local permite editar servicios y galería sin tocar Supabase", async () => {
  resetLocalSiteContentForTests();
  const repo = new LocalSiteContentRepository();
  const before = await repo.getAdminContent();
  assert.equal(before.services.length, DEFAULT_SITE_SERVICES.length);

  const updated = await repo.updateAdminContent({
    services: before.services.map((item) => item.id === "music-choice" ? { ...item, description: "Música elegida por el cliente." } : item),
    gallery: [{ id: "foto-1", title: "Cancha", imageUrl: "https://example.com/cancha.webp", altText: "Cancha de Valeibol", sortOrder: 10, isVisible: true }],
    theme: { ...before.theme, presetId: "custom", yellow: "#F1C232" },
  });
  assert.equal(updated.source, "local");
  assert.equal(updated.services.find((item) => item.id === "music-choice")?.description, "Música elegida por el cliente.");
  assert.equal(updated.gallery[0]?.imageUrl, "https://example.com/cancha.webp");
  assert.equal(updated.theme.yellow, "#F1C232");
});

test("migración de contenido mantiene tablas privadas y expone solo RPC pública sanitizada", async () => {
  const sql = await readFile("supabase/migrations/202610150012_site_content_admin.sql", "utf8");
  assert.match(sql, /alter table public\.business_site_content enable row level security/i);
  assert.match(sql, /revoke all on public\.business_site_content from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.get_public_site_content\(text\) to anon, authenticated/i);
  assert.match(sql, /where coalesce\(\(item->>'isVisible'\)::boolean, true\)/i);
  assert.match(sql, /v_actor\.role not in \('owner', 'admin'\)/i);
  assert.match(sql, /business-gallery/i);
  assert.doesNotMatch(sql, /WHATSAPP_ACCESS_TOKEN|WHATSAPP_PHONE_NUMBER_ID/i);

  const themeSql = await readFile("supabase/migrations/202610150019_site_theme_brand_gallery.sql", "utf8");
  assert.match(themeSql, /add column if not exists theme jsonb/i);
  assert.match(themeSql, /p_theme jsonb/i);
  assert.match(themeSql, /\^\/images\//i);
  assert.match(themeSql, /revoke all on public\.business_site_content from public, anon, authenticated/i);
});

