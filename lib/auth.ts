export type AdminRole = "owner" | "admin" | "staff";

export type AdminAccessState =
  | "unconfigured"
  | "unauthenticated"
  | "unauthorized"
  | "authorized";

export function isAdminRole(value: unknown): value is AdminRole {
  return value === "owner" || value === "admin" || value === "staff";
}

export function adminRoleLabel(role: AdminRole) {
  if (role === "owner") return "Propietario";
  if (role === "admin") return "Administrador";
  return "Personal";
}

export function safeAdminRedirectPath(candidate: string | null | undefined) {
  if (!candidate) return "/admin";
  if (!candidate.startsWith("/admin")) return "/admin";
  if (candidate.startsWith("//") || candidate.includes("://")) return "/admin";
  if (candidate.startsWith("/admin/login") || candidate.startsWith("/admin/acceso-denegado")) return "/admin";
  return candidate;
}

export function decideAdminAccess(input: {
  hasSupabaseConfig: boolean;
  userId?: string | null;
  role?: unknown;
  isProfileActive?: boolean;
}): AdminAccessState {
  if (!input.hasSupabaseConfig) return "unconfigured";
  if (!input.userId) return "unauthenticated";
  if (!input.isProfileActive || !isAdminRole(input.role)) return "unauthorized";
  return "authorized";
}
