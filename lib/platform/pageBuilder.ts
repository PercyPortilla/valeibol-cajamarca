import { validPlatformBusinessId } from "@/lib/auth/platformScope";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { normalizeSiteGallery, normalizeSiteLogoUrl, normalizeSiteServices, normalizeSiteTheme, isValidSiteThemeInput, type SiteContent } from "@/lib/siteContent";

export type PageBuilderRevision = { id: string; publishedAt: string; publishedBy: string | null };
export type PageBuilderState = {
  published: SiteContent | null;
  draft: SiteContent | null;
  draftVersion: number;
  draftPublished: boolean;
  draftUpdatedAt: string | null;
  basedOnUpdatedAt: string | null;
  publishedAt: string | null;
  revisions: PageBuilderRevision[];
};

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

function stateRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PageBuilderError("backend");
  return value as Record<string, unknown>;
}

function parseDraftContent(raw: unknown, updatedAt: string | null): SiteContent | null {
  if (raw === null) return null;
  const data = stateRecord(raw);
  if (!isValidSiteThemeInput(data.theme) || !Array.isArray(data.services) || !Array.isArray(data.gallery)) {
    throw new PageBuilderError("backend");
  }
  return {
    logoUrl: normalizeSiteLogoUrl(data.logoUrl),
    services: normalizeSiteServices(data.services),
    gallery: normalizeSiteGallery(data.gallery),
    theme: normalizeSiteTheme(data.theme),
    updatedAt,
    source: "supabase",
  };
}

export function parsePageBuilderState(raw: unknown): PageBuilderState {
  const row = stateRecord(raw);
  const draftUpdatedAt = typeof row.draftUpdatedAt === "string" ? row.draftUpdatedAt : null;
  const draftVersion = Number(row.draftVersion);
  if (!Number.isSafeInteger(draftVersion) || draftVersion < 0) throw new PageBuilderError("backend");
  return {
    published: parseDraftContent(row.published ?? null, typeof row.publishedAt === "string" ? row.publishedAt : null),
    draft: parseDraftContent(row.draft ?? null, draftUpdatedAt),
    draftVersion,
    draftPublished: row.draftPublished === true,
    draftUpdatedAt,
    basedOnUpdatedAt: typeof row.basedOnUpdatedAt === "string" ? row.basedOnUpdatedAt : null,
    publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : null,
    revisions: Array.isArray(row.revisions)
      ? row.revisions.slice(0, 20).flatMap((revision) => {
          if (!revision || typeof revision !== "object" || Array.isArray(revision)) return [];
          const item = revision as Record<string, unknown>;
          if (typeof item.id !== "string" || !/^[1-9]\d{0,15}$/.test(item.id) || typeof item.publishedAt !== "string") return [];
          return [{ id: item.id, publishedAt: item.publishedAt, publishedBy: typeof item.publishedBy === "string" ? item.publishedBy : null }];
        })
      : [],
  };
}

/** No usar un businessId enviado desde el navegador como permiso. */
export async function getScopedPageBuilderClient(businessId: string) {
  if (!validPlatformBusinessId(businessId)) throw new PageBuilderError("invalid_id");
  const client = await createServerSupabaseClient({ explicitPlatformBusinessId: businessId });
  const [{ data: user, error: userError }, { data, error }, platform] = await Promise.all([
    client.auth.getUser(),
    client.rpc("get_current_admin_context"),
    client.rpc("get_platform_admin_context"),
  ]);
  if (userError || !user.user) throw new PageBuilderError("unauthorized");
  if (error) throw new PageBuilderError("backend");
  const globalAdmin = !platform.error && (platform.data?.length ?? 0) > 0;
  if (!data?.some((row) => row.business_id === businessId
    && (globalAdmin ? row.role === "admin" : row.role === "owner" || row.role === "admin"))) {
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

export async function loadPageBuilder(businessId: string): Promise<{ business: PageBuilderBusiness; content: SiteContent; builderState: PageBuilderState }> {
  const client = await getScopedPageBuilderClient(businessId);
  const [business, contentResult, stateResult] = await Promise.all([
    findPageBuilderBusiness(client, businessId),
    client.rpc("get_admin_site_content"),
    client.rpc("platform_page_builder_get_state", { p_business_id: businessId }),
  ]);
  if (contentResult.error || stateResult.error) throw new PageBuilderError("backend");
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
    builderState: parsePageBuilderState(stateResult.data),
  };
}
