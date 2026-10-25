import type { Json } from "../data/supabase/database.types.ts";

export type AdminInventoryCourt = {
  courtId: string;
  slug: string;
  name: string;
  surface: string | null;
  sportId: string;
  sportSlug: string;
  sportName: string;
  isActive: boolean;
  hoursConfigured: boolean;
  pricingConfigured: boolean;
  operatingHours: AdminInventoryOperatingHour[];
};

export type AdminInventoryOperatingHour = {
  weekday: number;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  configurationStatus: "provisional" | "confirmed";
};

export type AdminInventorySport = {
  sportId: string;
  slug: string;
  name: string;
};

export type AdminInventoryVenue = {
  venueId: string;
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  courts: AdminInventoryCourt[];
};

export type AdminBusinessStructure = {
  businessId: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
  timezone: string;
  bookingIncrementMinutes: number;
  configurationStatus: "provisional" | "confirmed";
  publicationReadiness: {
    hasActiveVenue: boolean;
    hasActiveCourt: boolean;
    activeCourtsReady: boolean;
    activeCourtCount: number;
  };
  sports: AdminInventorySport[];
  venues: AdminInventoryVenue[];
};

function objectValue(value: Json): { [key: string]: Json | undefined } | null {
  return value !== null && !Array.isArray(value) && typeof value === "object" ? value : null;
}

function stringValue(value: Json | undefined) {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: Json | undefined) {
  return value === true;
}

function numberValue(value: Json | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseOperatingHours(value: Json | undefined): AdminInventoryOperatingHour[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawHour) => {
    const hour = objectValue(rawHour);
    const weekday = hour ? numberValue(hour.weekday) : null;
    const effectiveFrom = hour ? stringValue(hour.effectiveFrom) : null;
    const status = hour ? stringValue(hour.configurationStatus) : null;
    if (!hour || !weekday || weekday < 1 || weekday > 7 || !effectiveFrom || (status !== "provisional" && status !== "confirmed")) return [];
    const isOpen = booleanValue(hour.isOpen);
    return [{
      weekday,
      isOpen,
      opensAt: isOpen ? stringValue(hour.opensAt)?.slice(0, 5) ?? null : null,
      closesAt: isOpen ? stringValue(hour.closesAt)?.slice(0, 5) ?? null : null,
      effectiveFrom,
      effectiveUntil: stringValue(hour.effectiveUntil),
      configurationStatus: status,
    }];
  });
}

export function parseInventoryVenues(value: Json): AdminInventoryVenue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawVenue) => {
    const venue = objectValue(rawVenue);
    const venueId = venue ? stringValue(venue.venueId) : null;
    const slug = venue ? stringValue(venue.slug) : null;
    const name = venue ? stringValue(venue.name) : null;
    if (!venue || !venueId || !slug || !name) return [];
    const courtsValue = venue.courts;
    const courts: AdminInventoryCourt[] = Array.isArray(courtsValue)
      ? courtsValue.flatMap((rawCourt) => {
          const court = objectValue(rawCourt);
          const courtId = court ? stringValue(court.courtId) : null;
          const courtSlug = court ? stringValue(court.slug) : null;
          const courtName = court ? stringValue(court.name) : null;
          const sportId = court ? stringValue(court.sportId) : null;
          const sportSlug = court ? stringValue(court.sportSlug) : null;
          const sportName = court ? stringValue(court.sportName) : null;
          if (!court || !courtId || !courtSlug || !courtName || !sportId || !sportSlug || !sportName) return [];
          return [{
            courtId,
            slug: courtSlug,
            name: courtName,
            surface: stringValue(court.surface),
            sportId,
            sportSlug,
            sportName,
            isActive: booleanValue(court.isActive),
            hoursConfigured: booleanValue(court.hoursConfigured),
            pricingConfigured: booleanValue(court.pricingConfigured),
            operatingHours: parseOperatingHours(court.operatingHours),
          }];
        })
      : [];
    return [{
      venueId,
      slug,
      name,
      city: stringValue(venue.city),
      address: stringValue(venue.address),
      latitude: numberValue(venue.latitude),
      longitude: numberValue(venue.longitude),
      isActive: booleanValue(venue.isActive),
      courts,
    }];
  });
}

export function parseInventorySports(value: Json): AdminInventorySport[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawSport) => {
    const sport = objectValue(rawSport);
    const sportId = sport ? stringValue(sport.sportId) : null;
    const slug = sport ? stringValue(sport.slug) : null;
    const name = sport ? stringValue(sport.name) : null;
    return sportId && slug && name ? [{ sportId, slug, name }] : [];
  });
}

\n