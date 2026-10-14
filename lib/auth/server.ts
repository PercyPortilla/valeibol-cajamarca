import { redirect } from "next/navigation";
import { hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { adminRoleLabel, isAdminRole, type AdminRole } from "@/lib/auth";
import type { Database } from "@/lib/data/supabase/database.types";

export type AdminContext = {
  userId: string;
  email: string | null;
  businessId: string;
  businessName: string;
  role: AdminRole;
  roleLabel: string;
  displayName: string | null;
  timezone: string;
};

export class AdminAuthError extends Error {
  constructor(
    public readonly code: "unconfigured" | "unauthenticated" | "unauthorized" | "network",
    message: string,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export async function getAdminContext(): Promise<AdminContext> {
  if (!hasPublicSupabaseServerConfig()) {
    throw new AdminAuthError("unconfigured", "Supabase/Auth no está configurado.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new AdminAuthError("unauthenticated", "La sesión no existe o expiró.");
  }

  const { data, error } = await supabase.rpc("get_current_admin_context");
  if (error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes("permission") || normalized.includes("profile")) {
      throw new AdminAuthError("unauthorized", "La cuenta no tiene un perfil administrativo autorizado.");
    }
    throw new AdminAuthError("network", "No pudimos validar el perfil administrativo.");
  }

  type Row = Database["public"]["Functions"]["get_current_admin_context"]["Returns"][number];
  const row = ((data ?? []) as Row[])[0];
  if (!row || !isAdminRole(row.role)) {
    throw new AdminAuthError("unauthorized", "La cuenta no tiene un perfil administrativo activo.");
  }

  return {
    userId: userData.user.id,
    email: userData.user.email ?? null,
    businessId: row.business_id,
    businessName: row.business_name,
    role: row.role,
    roleLabel: adminRoleLabel(row.role),
    displayName: row.display_name,
    timezone: row.timezone,
  };
}

export async function requireAdminContext(): Promise<AdminContext> {
  try {
    return await getAdminContext();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      if (error.code === "unconfigured") redirect("/admin/login?reason=config");
      if (error.code === "unauthenticated") redirect("/admin/login?reason=session");
      if (error.code === "unauthorized") redirect("/admin/acceso-denegado");
    }
    throw error;
  }
}
