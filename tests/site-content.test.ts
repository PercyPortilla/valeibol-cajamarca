import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SITE_GALLERY,
  DEFAULT_SITE_SERVICES,
  normalizeSiteGallery,
  normalizeSiteServices,
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
    "Iluminación opcional",
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
    { id: "b", icon: "B", title: "Segundo", description: "Servicio segundo", sortOrder: 20, isVisible: false },
    { id: "a", icon: "A", title: "Primero", description: "Servicio primero", sortOrder: 10, isVisible: true },
  ]);
  assert.deepEqual(services.map((item) => item.id), ["a", "b"]);
  assert.equal(services[1]?.isVisible, false);
  assert.deepEqual(normalizeSiteServices([]), []);
  assert.deepEqual(normalizeSiteGallery(null), DEFAULT_SITE_GALLERY);
  assert.equal(normalizeSiteGallery([{ id: "x", title: "X", imageUrl: "javascript:alert(1)", altText: "X", sortOrder: 1, isVisible: true }])[0]?.imageUrl, "");
  assert.equal(normalizeSiteGallery([{ id: "local", title: "Local", imageUrl: "/uploads/local-gallery/foto.webp", altText: "Local", sortOrder: 1, isVisible: true }])[0]?.imageUrl, "/uploads/local-gallery/foto.webp");
});

test("repositorio local permite editar servicios y galería sin tocar Supabase", async () => {
  resetLocalSiteContentForTests();
  const repo = new LocalSiteContentRepository();
  const before = await repo.getAdminContent();
  assert.equal(before.services.length, DEFAULT_SITE_SERVICES.length);

  const updated = await repo.updateAdminContent({
    services: before.services.map((item) => item.id === "music-choice" ? { ...item, description: "Música elegida por el cliente." } : item),
    gallery: [{ id: "foto-1", title: "Cancha", imageUrl: "https://example.com/cancha.webp", altText: "Cancha de Valeibol", sortOrder: 10, isVisible: true }],
  });
  assert.equal(updated.source, "local");
  assert.equal(updated.services.find((item) => item.id === "music-choice")?.description, "Música elegida por el cliente.");
  assert.equal(updated.gallery[0]?.imageUrl, "https://example.com/cancha.webp");
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
});
