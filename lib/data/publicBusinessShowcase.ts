import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Json } from "@/lib/data/supabase/database.types";

export type BusinessShowcaseCourt = {
  venueId: string;
  courtId: string;
  courtSlug: string;
  courtName: string;
  bookable: boolean;
  sports: { slug: string; name: string }[];
  priceFrom: number | null;
  currency: string;
};

function parseSports(value: Json): BusinessShowcaseCourt["sports"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || Array.isArray(entry) || typeof entry !== "object") return [];
    return typeof entry.slug === "string" && typeof entry.name === "string"
      ? [{ slug: entry.slug, name: entry.name }] : [];
  });
}

export async function getPublicBusinessShowcase(slug: string): Promise<BusinessShowcaseCourt[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_business_showcase", { p_business_slug: slug });
  if (error) throw new Error(`business_showcase:${error.code ?? "rpc_error"}`);
  return (data ?? []).map((row) => {
    const amount = row.price_from === null ? null : Number(row.price_from);
    return {
      venueId: row.venue_id,
      courtId: row.court_id,
      courtSlug: row.court_slug,
      courtName: row.court_name,
      bookable: row.is_bookable,
      sports: parseSports(row.sports),
      priceFrom: amount !== null && Number.isFinite(amount) ? amount : null,
      currency: row.currency,
    };
  });
}
