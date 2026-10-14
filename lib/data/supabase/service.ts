import { createClient } from "@supabase/supabase-js";

/**
 * Cliente privilegiado exclusivamente para rutas/jobs server-side.
 * Nunca importar este módulo desde un Client Component ni exponer la key con NEXT_PUBLIC_*.
 */
export function createServiceRoleSupabaseClient() {
  if (typeof window !== "undefined") {
    throw new Error("Service-role Supabase client is server-only.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "X-Client-Info": "valeibol-server" },
    },
  });
}
