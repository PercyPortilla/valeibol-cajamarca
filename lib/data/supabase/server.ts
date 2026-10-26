import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { PLATFORM_ADMIN_BUSINESS_COOKIE, PLATFORM_ADMIN_BUSINESS_HEADER, validPlatformBusinessId } from "@/lib/auth/platformScope";

export function hasPublicSupabaseServerConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const cookieStore = await cookies();
  const selectedBusinessId = validPlatformBusinessId(cookieStore.get(PLATFORM_ADMIN_BUSINESS_COOKIE)?.value);

  return createServerClient<Database>(url, anonKey, {
    global: selectedBusinessId
      ? { headers: { [PLATFORM_ADMIN_BUSINESS_HEADER]: selectedBusinessId } }
      : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // En Server Components Next puede impedir escritura de cookies.
          // Proxy/autenticación administrativa se encarga de refrescar la sesión.
        }
      },
    },
  });
}
