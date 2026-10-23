export type PlatformCatalogQuery = {
  sportSlug?: string | null;
  city?: string | null;
  businessSlug?: string | null;
};

export type PlatformCatalogItem = {
  businessId: string;
  businessSlug: string;
  businessName: string;
  businessCity: string | null;
  businessCountry: string | null;
  venueId: string;
  venueSlug: string;
  venueName: string;
  venueCity: string | null;
  venueAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  courtId: string;
  courtSlug: string;
  courtName: string;
  courtSurface: string | null;
  sportId: string;
  sportSlug: string;
  sportName: string;
  priceFrom: number | null;
  currency: string;
};

export type PlatformBusinessCard = {
  businessId: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  sports: string[];
  venues: number;
  courts: number;
  priceFrom: number | null;
  currency: string;
};

export type PlatformCourtDetail = {
  id: string;
  slug: string;
  name: string;
  surface: string | null;
  sportId: string;
  sportSlug: string;
  sportName: string;
  priceFrom: number | null;
  currency: string;
};

export type PlatformVenueDetail = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  courts: PlatformCourtDetail[];
};

export type PlatformBusinessDetail = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  venues: PlatformVenueDetail[];
};

export interface PlatformRepository {
  listCatalog(query?: PlatformCatalogQuery): Promise<PlatformCatalogItem[]>;
}

export function groupCatalogByBusiness(items: PlatformCatalogItem[]): PlatformBusinessCard[] {
  const groups = new Map<string, PlatformBusinessCard & { venueIds: Set<string>; courtIds: Set<string>; sportNames: Set<string> }>();

  for (const item of items) {
    const current = groups.get(item.businessId) ?? {
      businessId: item.businessId,
      slug: item.businessSlug,
      name: item.businessName,
      city: item.businessCity ?? item.venueCity,
      country: item.businessCountry,
      sports: [],
      venues: 0,
      courts: 0,
      priceFrom: item.priceFrom,
      currency: item.currency,
      venueIds: new Set<string>(),
      courtIds: new Set<string>(),
      sportNames: new Set<string>(),
    };

    current.venueIds.add(item.venueId);
    current.courtIds.add(item.courtId);
    current.sportNames.add(item.sportName);
    if (item.priceFrom !== null && (current.priceFrom === null || item.priceFrom < current.priceFrom)) {
      current.priceFrom = item.priceFrom;
    }
    groups.set(item.businessId, current);
  }

  return [...groups.values()].map(({ venueIds, courtIds, sportNames, ...business }) => ({
    ...business,
    sports: [...sportNames].sort(),
    venues: venueIds.size,
    courts: courtIds.size,
  }));
}

export function buildBusinessDetail(items: PlatformCatalogItem[], slug: string): PlatformBusinessDetail | null {
  const rows = items.filter((item) => item.businessSlug === slug);
  const first = rows[0];
  if (!first) return null;

  const venues = new Map<string, PlatformVenueDetail>();
  for (const item of rows) {
    const venue = venues.get(item.venueId) ?? {
      id: item.venueId,
      slug: item.venueSlug,
      name: item.venueName,
      city: item.venueCity,
      address: item.venueAddress,
      latitude: item.latitude,
      longitude: item.longitude,
      courts: [],
    };

    if (!venue.courts.some((court) => court.id === item.courtId)) {
      venue.courts.push({
        id: item.courtId,
        slug: item.courtSlug,
        name: item.courtName,
        surface: item.courtSurface,
        sportId: item.sportId,
        sportSlug: item.sportSlug,
        sportName: item.sportName,
        priceFrom: item.priceFrom,
        currency: item.currency,
      });
    }
    venues.set(item.venueId, venue);
  }

  return {
    id: first.businessId,
    slug: first.businessSlug,
    name: first.businessName,
    city: first.businessCity,
    country: first.businessCountry,
    venues: [...venues.values()],
  };
}
