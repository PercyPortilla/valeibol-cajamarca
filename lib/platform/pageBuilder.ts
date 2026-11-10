import { getPlatformAdminContext } from "@/lib/auth/platformAdmin";
import { validPlatformBusinessId } from "@/lib/auth/platformScope";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { normalizeSiteGallery, normalizeSiteLogoUrl, normalizeSiteServices, normalizeSiteTheme, type SiteContent } from "@/lib/siteContent";

export type PageBuilderBusiness = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  isActive: boolean;
  configurationStatus: "provisional" | "confirmed";
};

export class PageBuilderError extends Error {
  constructor(public code: "invalid_id" | "not_found" | "unauthorized" | "backend") {
    super(code);
  }
}

/** No usar un businessId enviado desde el navegador como permiso. */
export async function getScopedPageBuilderClient(businessId: string) {
  if (!validPlatformBusinessId(businessId)) throw new PageBuilderError("invalid_id");
  await getPlatformAdminContext();
  const client = await createServerSupabaseClient({ explicitPlatformBusinessId: businessId });
  const { data, error } = await client.rpc("get_current_admin_context");
  if (error) throw new PageBuilderError("backend");
  if (!data?.some((row) => row.business_id === businessId && row.role === "admin")) {
    throw new PageBuilderError("unauthorized");
  }
  return client;
}

/** Listado global autoritativo: el schema TS no expone tablas directas. */
export async function findPageBuilderBusiness(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  businessId: string,
): Promise<PageBuilderBusiness | null> {
  for (let offset = 0; offset < 100_000; offset += 100) {
    const { data, error } = await client.rpc("get_platform_admin_businesses_page", { p_limit: 100, p_offset: offset });
    if (error) throw new PageBuilderError("backend");
    const row = data?.find((item) => item.business_id === businessId);
    if (row) return {
      id: row.business_id,
      name: row.name,
      slug: row.slug,
      city: row.city,
      country: row.country,
      isActive: row.is_active,
      configurationStatus: row.configuration_status,
    };
    if ((data?.length ?? 0) < 100) return null;
  }
  throw new PageBuilderError("backend");
}

export async function loadPageBuilder(businessId: string): Promise<{ business: PageBuilderBusiness; content: SiteContent }> {
  const client = await getScopedPageBuilderClient(businessId);
  const [business, contentResult] = await Promise.all([
    findPageBuilderBusiness(client, businessId),
    client.rpc("get_admin_site_content"),
  ]);
  if (contentResult.error) throw new PageBuilderError("backend");
  if (!business) throw new PageBuilderError("not_found");
  const row = contentResult.data?.find((item) => item.business_id === businessId);
  if (!row) throw new PageBuilderError("backend");
  return {
    business,
    content: {
      logoUrl: normalizeSiteLogoUrl(row.logo_url),
      services: normalizeSiteServices(row.services),
      gallery: normalizeSiteGallery(row.gallery),
      theme: normalizeSiteTheme(row.theme),
      updatedAt: row.updated_at,
      source: "supabase",
    },
  };
}
