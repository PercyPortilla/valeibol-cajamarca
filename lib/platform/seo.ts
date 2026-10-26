import type { PlatformBusinessCard, PlatformBusinessDetail } from "../data/repositories/platformRepository.ts";
import { absoluteSiteUrl } from "./siteUrl.ts";
import { platformConfig } from "../../config/platform.ts";

export type JsonLd = Record<string, unknown>;

export function serializeJsonLd(data: JsonLd) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; pathname: string }>): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => {
      const url = absoluteSiteUrl(item.pathname);
      return {
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        ...(url ? { item: url } : {}),
      };
    }),
  };
}

export function buildMarketplaceJsonLd(businesses: PlatformBusinessCard[]): JsonLd {
  const homeUrl = absoluteSiteUrl("/");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        ...(homeUrl ? { "@id": `${homeUrl}#website`, url: homeUrl } : {}),
        name: platformConfig.name,
        description: `Plataforma deportiva para descubrir complejos, sedes y canchas en ${platformConfig.city}.`,
        inLanguage: "es-PE",
      },
      {
        "@type": "ItemList",
        name: "Complejos deportivos disponibles",
        numberOfItems: businesses.length,
        itemListElement: businesses.map((business, index) => {
          const url = absoluteSiteUrl(`/complejo/${encodeURIComponent(business.slug)}`);
          return {
            "@type": "ListItem",
            position: index + 1,
            ...(url ? { url } : {}),
            name: business.name,
          };
        }),
      },
    ],
  };
}

export function buildBusinessJsonLd(business: PlatformBusinessDetail): JsonLd {
  const pageUrl = absoluteSiteUrl(`/complejo/${encodeURIComponent(business.slug)}`);
  const organizationId = pageUrl ? `${pageUrl}#organization` : undefined;
  const logo = business.logoUrl
    ? business.logoUrl.startsWith("http")
      ? business.logoUrl
      : absoluteSiteUrl(business.logoUrl) ?? undefined
    : undefined;
  const image = business.coverImageUrl
    ? business.coverImageUrl.startsWith("http")
      ? business.coverImageUrl
      : absoluteSiteUrl(business.coverImageUrl) ?? undefined
    : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        ...(organizationId ? { "@id": organizationId } : {}),
        name: business.name,
        ...(pageUrl ? { url: pageUrl } : {}),
        ...(logo ? { logo } : {}),
        ...(image ? { image } : {}),
        ...(business.city || business.country
          ? { areaServed: [business.city, business.country].filter(Boolean).join(", ") }
          : {}),
        ...(business.reviewCount > 0 && business.ratingAverage !== null
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: business.ratingAverage,
                reviewCount: business.reviewCount,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      },
      ...business.venues.flatMap((venue) => {
        const hasGeo = typeof venue.latitude === "number" && Number.isFinite(venue.latitude)
          && typeof venue.longitude === "number" && Number.isFinite(venue.longitude);
        const hasAddress = Boolean(venue.address?.trim());
        if (!hasAddress && !hasGeo) return [];
        const address = hasAddress
          ? {
              "@type": "PostalAddress",
              streetAddress: venue.address?.trim(),
              ...(venue.city ? { addressLocality: venue.city } : {}),
              ...(business.country ? { addressCountry: business.country } : {}),
            }
          : undefined;
        return [{
          "@type": "SportsActivityLocation",
          ...(pageUrl ? { "@id": `${pageUrl}#venue-${venue.id}` } : {}),
          name: business.venues.length > 1 ? `${business.name} · ${venue.name}` : business.name,
          ...(pageUrl ? { url: pageUrl } : {}),
          ...(image ? { image } : {}),
          ...(organizationId ? { parentOrganization: { "@id": organizationId } } : {}),
          ...(address ? { address } : {}),
          ...(hasGeo
            ? {
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: venue.latitude,
                  longitude: venue.longitude,
                },
              }
            : {}),
        }];
      }),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Inicio",
            ...(absoluteSiteUrl("/") ? { item: absoluteSiteUrl("/") } : {}),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Buscar canchas",
            ...(absoluteSiteUrl("/buscar") ? { item: absoluteSiteUrl("/buscar") } : {}),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: business.name,
            ...(pageUrl ? { item: pageUrl } : {}),
          },
        ],
      },
    ],
  };
}
