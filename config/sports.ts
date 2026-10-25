import type { Sport } from "../lib/domain/models.ts";

export const sports = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    name: "Vóley",
    slug: "voley",
    icon: null,
    active: true,
  },
  {
    id: "60000000-0000-4000-8000-000000000002",
    name: "Fútbol",
    slug: "futbol",
    icon: null,
    active: true,
  },
  {
    id: "60000000-0000-4000-8000-000000000003",
    name: "Futsal",
    slug: "futsal",
    icon: null,
    active: true,
  },
  {
    id: "60000000-0000-4000-8000-000000000004",
    name: "Básquet",
    slug: "basquet",
    icon: null,
    active: true,
  },
] as const satisfies readonly Sport[];

export type KnownSportSlug = (typeof sports)[number]["slug"];
export type SportSlug = string;

export const sportBookingRules: Record<KnownSportSlug, { requiresNetHeight: boolean }> = {
  voley: { requiresNetHeight: true },
  futbol: { requiresNetHeight: false },
  futsal: { requiresNetHeight: false },
  basquet: { requiresNetHeight: false },
};

export function getSportBySlug(slug: string) {
  return sports.find((sport) => sport.slug === slug) ?? null;
}

export function getSportById(id: string) {
  return sports.find((sport) => sport.id === id) ?? null;
}

export function sportRequiresNetHeight(slug: string) {
  return slug in sportBookingRules
    ? sportBookingRules[slug as KnownSportSlug].requiresNetHeight
    : false;
}
