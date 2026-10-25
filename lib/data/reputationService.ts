import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";

export type PublicBusinessReview = Database["public"]["Functions"]["get_public_business_reviews"]["Returns"][number];
export type PublicBusinessReviewsResult = { reviews: PublicBusinessReview[]; loadFailed: boolean };

export async function getPublicBusinessReviews(businessSlug: string, limit = 12): Promise<PublicBusinessReviewsResult> {
  if (!hasPublicSupabaseServerConfig()) return { reviews: [], loadFailed: false };
  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_public_business_reviews", {
      p_business_slug: businessSlug,
      p_limit: Math.max(1, Math.min(limit, 50)),
    });
    if (error) throw error;
    return { reviews: data ?? [], loadFailed: false };
  } catch (error) {
    console.error("[public-reviews] No se pudieron cargar reseñas.", error instanceof Error ? error.message : "unknown");
    return { reviews: [], loadFailed: true };
  }
}
