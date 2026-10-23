import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import type { PlatformCatalogItem, PlatformCatalogQuery, PlatformRepository } from "./platformRepository";

function toNullableNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export class SupabasePlatformRepository implements PlatformRepository {
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
