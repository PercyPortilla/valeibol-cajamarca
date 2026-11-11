import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  normalizeSiteExtraSections, normalizeSiteExternalUrl, normalizeSiteSectionLayout,
  normalizeSiteTheme, SITE_THEME_PRESETS,
} from "../lib/siteContent.ts";
import { applyPageBuilderTemplate, PAGE_BUILDER_TEMPLATES } from "../lib/platform/pageBuilderTemplates.ts";

const studio = readFileSync("components/platform-admin/PageBuilderStudio.tsx", "utf8");
const tools = readFileSync("components/platform-admin/PageBuilderV2Tools.tsx", "utf8");
const route = readFileSync("app/api/admin-global/page-builder/[businessId]/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261111112500_caxas_studio_v2_drafts_revisions.sql", "utf8");
const publicPage = readFileSync("app/complejo/[slug]/page.tsx", "utf8");
const schema = readFileSync("lib/data/supabase/database.types.ts", "utf8");

test("secciones adicionales: contenido limitado, ids únicos y URL seguras", () => {
  const normalized = normalizeSiteExtraSections([
    { id: "historia", title: "Nuestra historia", description: "x".repeat(600), imageUrl: "https://example.com/foto.png", buttonUrl: "javascript:alert(1)", buttonLabel: "Más información" },
    { id: "historia", title: "Duplicada", description: "" },
    { id: "vip", title: "Eventos", buttonUrl: "https://example.com/informacion" },
    { id: "gallery", title: "Reservado" },
    { id: "x", title: "" },
  ]);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].description.length, 500);
  assert.equal(normalized[0].buttonUrl, "");
  assert.equal(normalized[1].buttonUrl, "https://example.com/informacion");
  assert.equal(normalizeSiteExternalUrl("data:text/html,abc"), "");
  assert.equal(normalizeSiteExternalUrl("http://example.com"), "");
});

test("layout solo ordena secciones permitidas, respeta custom y elimina duplicados", () => {
  const extras = normalizeSiteExtraSections([{ id: "eventos", title: "Eventos" }]);
  assert.deepEqual(
    normalizeSiteSectionLayout(["gallery", "eventos", "gallery", "admin", "services"], extras),
    ["gallery", "eventos", "services"],
  );
  assert.deepEqual(normalizeSiteSectionLayout(null, extras), ["services", "gallery", "eventos"]);
  const theme = normalizeSiteTheme({ ...SITE_THEME_PRESETS[0].theme, sectionLayout: ["gallery", "eventos"], extraSections: extras });
  assert.deepEqual(theme.sectionLayout, ["gallery", "eventos", "services"]);
});

test("plantillas deportivas preservan datos y no inventan canchas ni fotos", () => {
  assert.deepEqual(PAGE_BUILDER_TEMPLATES.map((item) => item.id), ["futbol", "voley", "basquet", "multideporte"]);
  const original = normalizeSiteTheme({
    ...SITE_THEME_PRESETS[0].theme, pageHeadline: "Complejo Central",
    extraSections: [{ id: "historia", title: "Nuestra historia", description: "", imageUrl: "", buttonLabel: "", buttonUrl: "", isVisible: true }],
  });
  for (const template of PAGE_BUILDER_TEMPLATES) {
    const result = applyPageBuilderTemplate(original, template.id);
    assert.equal(result.pageHeadline, "Complejo Central");
    assert.equal(result.extraSections?.length, 1);
    assert.ok(result.sectionLayout?.includes("historia"));
    assert.ok(result.pageIntro);
  }
});

test("borradores privados solo se publican explícitamente y por negocio", () => {
  for (const marker of [
    "private.platform_page_builder_drafts", "private.platform_page_builder_revisions",
    "enable row level security", "revoke all on private.platform_page_builder_drafts",
    "private.platform_admin_selected_business_id() is distinct from p_business_id",
    "auth.uid() is null or not public.is_platform_admin()",
    "platform_page_builder_get_state", "platform_page_builder_save_draft",
    "platform_page_builder_publish_draft", "platform_page_builder_restore_revision",
    "platform_page_builder_discard_draft", "page_builder_live_changed", "page_builder_draft_changed",
    "public.admin_update_site_content", "limit 20",
  ]) assert.ok(migration.includes(marker), marker);
  assert.match(migration, /perform private\.platform_page_builder_assert_actor\(p_business_id\)/);
  assert.match(migration, /is distinct from v_draft\.based_on_updated_at/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function PUT/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /"live_changed", 409/);
  assert.match(route, /"draft_changed", 409/);
  assert.match(schema, /platform_page_builder_get_state/);
  assert.match(schema, /platform_page_builder_publish_draft/);
});

test("la interfaz tiene plantilla, drag-and-drop, guardado privado, publicación e historial", () => {
  assert.match(studio, /BuilderTemplatePanel/);
  assert.match(studio, /BuilderSectionsPanel/);
  assert.match(studio, /BuilderHistoryPanel/);
  assert.match(tools, /draggable/);
  assert.match(tools, /onDragStart/);
  assert.match(tools, /onDrop/);
  assert.match(studio, /method: "POST"/);
  assert.match(studio, /method: "PUT"/);
  assert.match(studio, /method: "PATCH"/);
  assert.match(studio, /method: "DELETE"/);
  assert.match(studio, /expectedVersion: draftVersion/);
  assert.match(studio, /"Borrador guardado\./);
  assert.match(studio, /"Diseño publicado\./);
  assert.match(publicPage, /platform-custom-section/);
  assert.match(publicPage, /siteContent\.theme\.sectionLayout/);
});
