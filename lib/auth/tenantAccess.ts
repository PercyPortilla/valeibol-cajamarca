const TENANT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Entrada explícita al panel privado de una página hija. */
export function tenantAdminEntryPath(slug: string) {
  return TENANT_SLUG_RE.test(slug) ? `/complejo/${slug}/administrar` : null;
}

/** Solo permite volver desde login a una página hija, nunca a una URL externa. */
export function safeTenantAdminRedirectPath(candidate: string | null | undefined) {
  if (!candidate) return null;
  const match = /^\/complejo\/([a-z0-9]+(?:-[a-z0-9]+)*)\/administrar\/?$/.exec(candidate);
  return match ? tenantAdminEntryPath(match[1]) : null;
}
