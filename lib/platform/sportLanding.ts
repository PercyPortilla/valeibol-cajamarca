import { cache } from "react";
import type { Metadata } from "next";
import type { SportSlug } from "../../config/sports.ts";
import { getPublicPlatformCatalog } from "../data/platformService.ts";
import { groupCatalogByBusiness } from "../data/repositories/platformRepository.ts";
import { sportRoute } from "./routes.ts";
import { platformConfig } from "../../config/platform.ts";

export type SportLandingDefinition = {
  slug: SportSlug;
  eyebrow: string;
  title: string;
  description: string;
  openGraphDescription: string;
};

export const SPORT_LANDING_DEFINITIONS: readonly SportLandingDefinition[] = [
  {
    slug: "voley",
    eyebrow: "VÓLEY",
    title: "Canchas de vóley",
    description: "Encuentra canchas y complejos de vóley en Cajamarca, compara sedes y consulta disponibilidad.",
    openGraphDescription: "Explora complejos de vóley en Cajamarca y consulta sus canchas disponibles.",
  },
  {
    slug: "futbol",
    eyebrow: "FÚTBOL",
    title: "Canchas de fútbol",
    description: "Encuentra canchas y complejos de fútbol en Cajamarca, compara sedes y consulta disponibilidad.",
    openGraphDescription: "Explora complejos de fútbol en Cajamarca y consulta sus canchas disponibles.",
  },
  {
    slug: "futsal",
    eyebrow: "FUTSAL",
    title: "Canchas de futsal",
    description: "Encuentra canchas y complejos de futsal en Cajamarca, compara sedes y consulta disponibilidad.",
    openGraphDescription: "Explora complejos de futsal en Cajamarca y consulta sus canchas disponibles.",
  },
  {
    slug: "basquet",
    eyebrow: "BÁSQUET",
    title: "Canchas de básquet",
    description: "Encuentra canchas y complejos de básquet en Cajamarca, compara sedes y consulta disponibilidad.",
    openGraphDescription: "Explora complejos de básquet en Cajamarca y consulta sus canchas disponibles.",
  },
] as const;

export function getSportLandingDefinition(slug: SportSlug, sportName?: string) {
  const definition = SPORT_LANDING_DEFINITIONS.find((item) => item.slug === slug);
  if (definition) return definition;
  const name = sportName?.trim() || slug;
  return {
    slug,
    eyebrow: name.toLocaleUpperCase("es-PE"),
    title: `Canchas de ${name}`,
    description: `Encuentra canchas y complejos de ${name} en ${platformConfig.city}, compara sedes y consulta disponibilidad.`,
    openGraphDescription: `Explora complejos de ${name} en ${platformConfig.city} y consulta sus canchas disponibles.`,
  };
}

export function getSportLandingPath(slug: SportSlug) {
  return sportRoute(slug);
}

export const getSportLandingBusinesses = cache(async (slug: SportSlug) => {
  return groupCatalogByBusiness(await getPublicPlatformCatalog({ sportSlug: slug }));
});

export function buildSportLandingMetadata(slug: SportSlug, hasInventory: boolean, sportName?: string): Metadata {
  const definition = getSportLandingDefinition(slug, sportName);
  const pathname = getSportLandingPath(slug);

  return {
    title: definition.title,
    description: definition.description,
    robots: hasInventory ? { index: true, follow: true } : { index: false, follow: true },
    ...(hasInventory
      ? {
          alternates: { canonical: pathname },
          openGraph: {
            title: `${definition.title} | ${platformConfig.name}`,
            description: definition.openGraphDescription,
            url: pathname,
          },
        }
      : {}),
  };
}
