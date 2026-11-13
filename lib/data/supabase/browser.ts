import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { PLATFORM_ADMIN_BUSINESS_HEADER, readPlatformBusinessIdFromDocument } from "@/lib/auth/platformScope";

export function hasPublicSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createPublicBrowserSupabaseClient(options?: { manualLinkExchange?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase público no está configurado. Use el fallback provisional de desarrollo.");
  }

  const selectedBusinessId = readPlatformBusinessIdFromDocument();
  // Solo URL + anon/publishable key. Nunca service-role en navegador.
  // El header de scope no concede permisos: PostgreSQL solo lo honra si la
  // sesión pertenece a un ADMIN global activo.
  return createBrowserClient<Database>(url, anonKey, {
    global: selectedBusinessId
      ? { headers: { [PLATFORM_ADMIN_BUSINESS_HEADER]: selectedBusinessId } }
      : undefined,
    // En /admin/activar el componente valida y canjea explícitamente el código
    // PKCE. Sin esto, el SDK puede canjearlo automáticamente en paralelo y
    // el segundo canje falla (código de un solo uso). No altera los otros flujos.
    ...(options?.manualLinkExchange
      ? { isSingleton: false, auth: { detectSessionInUrl: false } }
      : {}),
  });
}
