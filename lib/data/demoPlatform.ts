import { businessConfig } from "../../config/business.ts";
import { getSportBySlug } from "../../config/sports.ts";
import type { Business, Court, PlatformDemoData, User, Venue } from "../domain/models.ts";

export const DEMO_OWNER_ID = "70000000-0000-4000-8000-000000000001";
export const DEMO_BUSINESS_ID = "10000000-0000-4000-8000-000000000001";
export const DEMO_VENUE_ID = "30000000-0000-4000-8000-000000000001";
export const DEMO_COURT_ID = "20000000-0000-4000-8000-000000000001";
export const DEMO_COURT_NAME = "Cancha principal";

const volleyball = getSportBySlug("voley");

if (!volleyball) {
  throw new Error("La configuración central de deportes debe incluir vóley.");
}

export const demoOwner: User = {
  id: DEMO_OWNER_ID,
  name: `Propietario de ${businessConfig.name}`,
  email: null,
  phone: businessConfig.phone,
  role: "OWNER",
};

export const demoBusiness: Business = {
  id: DEMO_BUSINESS_ID,
  ownerId: demoOwner.id,
  name: businessConfig.name,
  slug: businessConfig.slug,
  description: businessConfig.category,
  logo: null,
  status: "ACTIVE",
};

export const demoVenue: Venue = {
  id: DEMO_VENUE_ID,
  businessId: demoBusiness.id,
  name: `${businessConfig.name} ${businessConfig.city}`,
  slug: businessConfig.slug,
  city: businessConfig.city,
  address: businessConfig.address,
  latitude: null,
  longitude: null,
  status: "ACTIVE",
};

export const demoCourt: Court = {
  id: DEMO_COURT_ID,
  venueId: demoVenue.id,
  name: DEMO_COURT_NAME,
  slug: "cancha-demo",
  sportId: volleyball.id,
  surface: "Cancha cubierta",
  pricePerHour: businessConfig.pricing.withoutLights,
  status: "ACTIVE",
};

export const demoPlatformData: PlatformDemoData = {
  users: [demoOwner],
  businesses: [demoBusiness],
  venues: [demoVenue],
  courts: [demoCourt],
  reservations: [],
};
