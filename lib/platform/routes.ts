export const platformRoutes = {
  home: "/",
  search: "/buscar",
  volleyball: "/voley",
  football: "/futbol",
  futsal: "/futsal",
  basketball: "/basquet",
  complexPattern: "/complejo/[slug]",
  reservation: "/reservar",
  account: "/mi-cuenta",
  owner: "/propietario",
  admin: "/admin",
} as const;

export function complexRoute(slug: string) {
  return `/complejo/${encodeURIComponent(slug)}`;
}

export function sportRoute(slug: string) {
  const legacy: Record<string, string> = {
    voley: platformRoutes.volleyball,
    futbol: platformRoutes.football,
    futsal: platformRoutes.futsal,
    basquet: platformRoutes.basketball,
  };
  return legacy[slug] ?? `/deportes/${encodeURIComponent(slug)}`;
}
