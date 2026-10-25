import { businessConfig } from "../../../config/business.ts";
import { getSportBySlug, sports } from "../../../config/sports.ts";
import { demoBusiness, demoCourt, demoVenue } from "../demoPlatform.ts";
import type { PlatformCatalogItem, PlatformCatalogQuery, PlatformRepository } from "./platformRepository.ts";

export class MockPlatformRepository implements PlatformRepository {
  async listSports() {
    return sports.filter((sport) => sport.active).map((sport, index) => ({
      id: sport.id,
      slug: sport.slug,
      name: sport.name,
      icon: sport.icon,
      sortOrder: (index + 1) * 10,
    }));
  }

  async listCatalog(query: PlatformCatalogQuery = {}): Promise<PlatformCatalogItem[]> {
    const sport = getSportBySlug("voley");
    if (!sport) return [];

    const row: PlatformCatalogItem = {
      businessId: demoBusiness.id,
      businessSlug: demoBusiness.slug,
      businessName: demoBusiness.name,
      businessCity: businessConfig.city,
      businessCountry: businessConfig.country,
      businessTimezone: businessConfig.timezone,
      coverImageUrl: "/images/valeibol-court-wide.webp",
      coverAltText: "Vista amplia de las instalaciones de Valeibol",
      ratingAverage: null,
      reviewCount: 0,
      venueId: demoVenue.id,
      venueSlug: demoVenue.slug,
      venueName: demoVenue.name,
      venueCity: demoVenue.city,
      venueAddress: demoVenue.address,
      latitude: demoVenue.latitude,
      longitude: demoVenue.longitude,
      courtId: demoCourt.id,
      courtSlug: demoCourt.slug,
      courtName: demoCourt.name,
      courtSurface: demoCourt.surface,
      sportId: sport.id,
      sportSlug: sport.slug,
      sportName: sport.name,
      priceFrom: demoCourt.pricePerHour,
      currency: businessConfig.currency,
    };

    if (query.sportSlug && query.sportSlug !== row.sportSlug) return [];
    if (query.city && query.city.trim().toLocaleLowerCase("es-PE") !== row.venueCity?.toLocaleLowerCase("es-PE")) return [];
    if (query.businessSlug && query.businessSlug !== row.businessSlug) return [];
    return [row];
  }
}
