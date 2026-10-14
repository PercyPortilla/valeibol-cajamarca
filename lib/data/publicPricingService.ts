import { businessConfig } from "@/config/business";
import { businessTodayDateKey } from "@/lib/availability";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";

export type PublicPricingSnapshot = {
  source: "supabase" | "mock-provisional" | "unavailable";
  currency: string;
  date: string;
  courtName: string | null;
  withoutLights: number | null;
  withLights: number | null;
};

function fallbackSnapshot(date: string): PublicPricingSnapshot {
  return {
    source: "mock-provisional",
    currency: businessConfig.currency,
    date,
    courtName: "Cancha demo (provisional)",
    withoutLights: businessConfig.pricing.withoutLights,
    withLights: businessConfig.pricing.withLights,
  };
}

export async function getPublicCurrentPricing(): Promise<PublicPricingSnapshot> {
  const date = businessTodayDateKey();
  if (!hasPublicSupabaseServerConfig()) return fallbackSnapshot(date);

  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_public_pricing_for_date", {
      p_business_slug: businessConfig.slug,
      p_date: date,
    });
    if (error) throw error;

    type Row = Database["public"]["Functions"]["get_public_pricing_for_date"]["Returns"][number];
    const rows = (data ?? []) as Row[];
    const firstCourtId = rows[0]?.court_id;
    const courtRows = firstCourtId ? rows.filter((row) => row.court_id === firstCourtId) : [];
    const without = courtRows.find((row) => row.lighting === "without_lights");
    const withLights = courtRows.find((row) => row.lighting === "with_lights");

    if (!without || !withLights) {
      return { source: "unavailable", currency: rows[0]?.currency ?? businessConfig.currency, date, courtName: rows[0]?.court_name ?? null, withoutLights: null, withLights: null };
    }

    return {
      source: "supabase",
      currency: without.currency,
      date,
      courtName: without.court_name,
      withoutLights: Number(without.hourly_rate),
      withLights: Number(withLights.hourly_rate),
    };
  } catch {
    return { source: "unavailable", currency: businessConfig.currency, date, courtName: null, withoutLights: null, withLights: null };
  }
}
