import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function hasPublicSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createPublicBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase público no está configurado. Use el fallback provisional de desarrollo.");
  }

  // Solo URL + anon/publishable key. Nunca service-role en navegador.
  return createBrowserClient<Database>(url, anonKey);
}
