import { businessConfig } from "@/config/business";
import { normalizePeruWhatsApp } from "@/lib/booking";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";

export type PublicBusinessContact = {
  phoneE164: string | null;
};

export function normalizePublicBusinessPhone(value: string | null | undefined) {
  return normalizePeruWhatsApp(value ?? "");
}

export async function getPublicBusinessContact(businessSlug: string): Promise<PublicBusinessContact> {
  const normalizedSlug = businessSlug.trim();
  const fallbackPhone = normalizedSlug === businessConfig.slug
    ? normalizePublicBusinessPhone(businessConfig.phone)
    : null;

  if (!normalizedSlug || !hasPublicSupabaseServerConfig()) return { phoneE164: fallbackPhone };

  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("get_public_business_config", { p_business_slug: normalizedSlug });
    if (error) {
      console.error("[public-business-contact] No se pudo leer el contacto público.", error.code ?? "rpc_error");
      return { phoneE164: fallbackPhone };
    }

    type Row = Database["public"]["Functions"]["get_public_business_config"]["Returns"][number];
    const row = ((data ?? []) as Row[])[0];
    return { phoneE164: normalizePublicBusinessPhone(row?.phone) ?? fallbackPhone };
  } catch (error) {
    console.error("[public-business-contact] Falló la carga del contacto público.", error instanceof Error ? error.message : "unknown");
    return { phoneE164: fallbackPhone };
  }
}
