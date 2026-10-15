import { createServerSupabaseClient } from "../supabase/server.ts";
import type { Database } from "../supabase/database.types.ts";
import { normalizeSiteGallery, normalizeSiteServices, normalizeSiteTheme, type SiteContent } from "../../siteContent.ts";
import { SiteContentRepositoryError, type SiteContentRepository, type UpdateSiteContentInput } from "./siteContentRepository.ts";

function mapError(message: string, code?: string) {
  const normalized = message.toLowerCase();
  if (code === "42501" || normalized.includes("insufficient_role") || normalized.includes("profile_required") || normalized.includes("permission")) {
    return new SiteContentRepositoryError("unauthorized", "Tu rol no permite modificar el contenido público.");
  }
  if (code === "22023" || normalized.includes("invalid_")) {
    return new SiteContentRepositoryError("validation", "El contenido enviado no es válido.");
  }
  if (normalized.includes("fetch") || normalized.includes("network")) {
    return new SiteContentRepositoryError("network", "No pudimos conectar con Supabase.");
  }
  return new SiteContentRepositoryError("unknown", "No pudimos completar la actualización del contenido.");
}

function contentFromRow(row: Database["public"]["Functions"]["get_admin_site_content"]["Returns"][number]): SiteContent {
  return {
    services: normalizeSiteServices(row.services),
    gallery: normalizeSiteGallery(row.gallery),
    theme: normalizeSiteTheme(row.theme),
    updatedAt: row.updated_at,
    source: "supabase",
  };
}

export class SupabaseSiteContentRepository implements SiteContentRepository {
  async getAdminContent() {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_admin_site_content");
    if (error) throw mapError(error.message, error.code);
    type Row = Database["public"]["Functions"]["get_admin_site_content"]["Returns"][number];
    const row = ((data ?? []) as Row[])[0];
    if (!row) throw new SiteContentRepositoryError("unknown", "No encontramos la configuración pública del negocio.");
    return contentFromRow(row);
  }

  async updateAdminContent(input: UpdateSiteContentInput): Promise<SiteContent> {
    const client = await createServerSupabaseClient();
    const services = normalizeSiteServices(input.services);
    const gallery = normalizeSiteGallery(input.gallery);
    const theme = normalizeSiteTheme(input.theme);
    const { data, error } = await client.rpc("admin_update_site_content", {
      p_services: services,
      p_gallery: gallery,
      p_theme: theme,
    });
    if (error) throw mapError(error.message, error.code);
    type Row = Database["public"]["Functions"]["admin_update_site_content"]["Returns"][number];
    const row = ((data ?? []) as Row[])[0];
    if (!row) throw new SiteContentRepositoryError("unknown", "Supabase no devolvió el contenido actualizado.");
    return {
      services: normalizeSiteServices(row.services),
      gallery: normalizeSiteGallery(row.gallery),
      theme: normalizeSiteTheme(row.theme),
      updatedAt: row.updated_at,
      source: "supabase",
    };
  }
}
