import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import type { PublicPaymentMethod } from "@/lib/payments";

export async function getPublicPaymentMethods(businessSlug: string): Promise<PublicPaymentMethod[]> {
  if (!hasPublicSupabaseServerConfig()) return [];
  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_public_payment_methods", { p_business_slug: businessSlug });
    if (error) return [];
    type Row = Database["public"]["Functions"]["get_public_payment_methods"]["Returns"][number];
    return ((data ?? []) as Row[]).map((row) => ({
      method: row.method,
      label: row.label,
      destination: row.destination,
      instructions: row.instructions,
    }));
  } catch {
    return [];
  }
}
