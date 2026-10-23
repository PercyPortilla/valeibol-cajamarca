export const platformRoutes = {
  home: "/",
  search: "/buscar",
  volleyball: "/voley",
  football: "/futbol",
  complexPattern: "/complejo/[slug]",
  reservation: "/reservar",
  account: "/mi-cuenta",
  owner: "/propietario",
  admin: "/admin",
} as const;

export function complexRoute(slug: string) {
  return `/complejo/${encodeURIComponent(slug)}`;
}
