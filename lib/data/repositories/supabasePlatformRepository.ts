import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import type { PlatformCatalogItem, PlatformCatalogQuery, PlatformRepository, PublicSport } from "./platformRepository";

function toNullableNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPublicImageUrl(value: string | null) {
  const url = value?.trim();
  if (!url) return null;
  if (/^\/images\/[A-Za-z0-9._/-]+$/.test(url)) return url;
  if (/^\/uploads\/local-gallery\/[A-Za-z0-9._-]+$/.test(url)) return url;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || parsed.origin !== new URL(supabaseUrl).origin || !parsed.pathname.startsWith("/storage/v1/object/public/business-gallery/")) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function toCoverAltText(value: string | null, businessName: string) {
  const alt = value?.trim().slice(0, 240);
  return alt || `Instalaciones de ${businessName}`;
}

export class SupabasePlatformRepository implements PlatformRepository {
  async listSports(): Promise<PublicSport[]> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_public_sports");
    if (error) throw new Error(`platform_sports:${error.code ?? "rpc_error"}`);
    type Row = Database["public"]["Functions"]["get_public_sports"]["Returns"][number];
    return ((data ?? []) as Row[]).map((row) => ({
      id: row.sport_id,
      slug: row.slug,
      name: row.name,
      icon: row.icon,
      sortOrder: row.sort_order,
    }));
  }

  async listCatalog(query: PlatformCatalogQuery = {}): Promise<PlatformCatalogItem[]> {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_public_platform_catalog", {
      p_sport_slug: query.sportSlug?.trim() || null,
      p_city: query.city?.trim() || null,
    });
    if (error) throw new Error(`platform_catalog:${error.code ?? "rpc_error"}`);

    type Row = Database["public"]["Functions"]["get_public_platform_catalog"]["Returns"][number];
    const rows = ((data ?? []) as Row[]).map((row) => ({
      businessId: row.business_id,
      businessSlug: row.business_slug,
      businessName: row.business_name,
      businessCity: row.business_city,
      businessCountry: row.business_country,
      businessTimezone: row.business_timezone,
      coverImageUrl: toPublicImageUrl(row.cover_image_url),
      coverAltText: row.cover_image_url ? toCoverAltText(row.cover_alt_text, row.business_name) : null,
      ratingAverage: toNullableNumber(row.rating_average),
      reviewCount: Number(row.review_count) || 0,
      venueId: row.venue_id,
      venueSlug: row.venue_slug,
      venueName: row.venue_name,
      venueCity: row.venue_city,
      venueAddress: row.venue_address,
      latitude: toNullableNumber(row.latitude),
      longitude: toNullableNumber(row.longitude),
      courtId: row.court_id,
      courtSlug: row.court_slug,
      courtName: row.court_name,
      courtSurface: row.court_surface,
      sportId: row.sport_id,
      sportSlug: row.sport_slug,
      sportName: row.sport_name,
      priceFrom: toNullableNumber(row.price_from),
      currency: row.currency,
    }));

    return query.businessSlug
      ? rows.filter((row) => row.businessSlug === query.businessSlug)
      : rows;
  }
}
