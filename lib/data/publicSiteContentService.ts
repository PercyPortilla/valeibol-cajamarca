import { businessConfig } from "@/config/business";
import { defaultSiteContent, normalizeSiteGallery, normalizeSiteServices, normalizeSiteTheme, type SiteContent } from "@/lib/siteContent";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import { cookies, headers } from "next/headers";
import { LOCAL_DEV_ADMIN_COOKIE, hostnameFromHostHeader, isLocalDevAdminAllowed } from "@/lib/auth/localDev";
import { LocalSiteContentRepository } from "@/lib/data/repositories/localSiteContentRepository";

export async function getPublicSiteContent(): Promise<SiteContent> {
  if (process.env.NODE_ENV !== "production") {
    const headerStore = await headers();
    const hostname = hostnameFromHostHeader(headerStore.get("host"));
    if (isLocalDevAdminAllowed({ nodeEnv: process.env.NODE_ENV, hostname })) {
      const cookieStore = await cookies();
      if (cookieStore.get(LOCAL_DEV_ADMIN_COOKIE)?.value === "1") {
        return new LocalSiteContentRepository().getAdminContent();
      }
    }
  }
  if (!hasPublicSupabaseServerConfig()) return defaultSiteContent();
  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_public_site_content", { p_business_slug: businessConfig.slug });
    if (error) {
      console.error("[site-content] No se pudo leer la configuración pública.", error.code ?? "rpc_error");
      return defaultSiteContent();
    }
    type Row = Database["public"]["Functions"]["get_public_site_content"]["Returns"][number];
    const row = ((data ?? []) as Row[])[0];
    if (!row) {
      console.warn("[site-content] No hay configuración pública para el negocio.");
      return defaultSiteContent();
    }
    return {
      services: normalizeSiteServices(row.services),
      gallery: normalizeSiteGallery(row.gallery),
      theme: normalizeSiteTheme(row.theme),
      updatedAt: row.updated_at,
      source: "supabase",
    };
  } catch (error) {
    console.error("[site-content] Falló la carga de configuración pública.", error instanceof Error ? error.message : "unknown");
    return defaultSiteContent();
  }
}

