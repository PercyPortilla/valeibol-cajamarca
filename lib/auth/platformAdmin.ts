import { redirect } from "next/navigation";
import { createServerSupabaseClient, hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";

export type PlatformAdminContext = {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "admin";
};

export class PlatformAdminAuthError extends Error {
  constructor(public readonly code: "unconfigured" | "unauthenticated" | "unauthorized" | "network", message: string) {
    super(message);
    this.name = "PlatformAdminAuthError";
  }
}

export async function getPlatformAdminContext(): Promise<PlatformAdminContext> {
  if (!hasPublicSupabaseServerConfig()) {
    throw new PlatformAdminAuthError("unconfigured", "Supabase/Auth no está configurado.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new PlatformAdminAuthError("unauthenticated", "La sesión no existe o expiró.");
  }

  const { data, error } = await supabase.rpc("get_platform_admin_context");
  if (error) throw new PlatformAdminAuthError("network", "No pudimos validar la administración global.");
  type Row = Database["public"]["Functions"]["get_platform_admin_context"]["Returns"][number];
  const row = ((data ?? []) as Row[])[0];
  if (!row || row.role !== "admin") {
    throw new PlatformAdminAuthError("unauthorized", "La cuenta no tiene privilegios de administrador global.");
  }

  return {
    userId: userData.user.id,
    email: userData.user.email ?? null,
    displayName: row.display_name,
    role: "admin",
  };
}

export async function requirePlatformAdminContext() {
  try {
    return await getPlatformAdminContext();
  } catch (error) {
    if (error instanceof PlatformAdminAuthError) {
      if (error.code === "unconfigured" || error.code === "unauthenticated") {
        redirect("/admin/login?next=/admin-global");
      }
      if (error.code === "unauthorized") redirect("/admin/acceso-denegado");
    }
    throw error;
  }
}
