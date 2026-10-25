import { hasPublicSupabaseServerConfig } from "@/lib/data/supabase/server";
import { MockPlatformRepository } from "./repositories/mockPlatformRepository";
import { SupabasePlatformRepository } from "./repositories/supabasePlatformRepository";
import type { PlatformCatalogQuery } from "./repositories/platformRepository";

export async function getPublicPlatformCatalog(query: PlatformCatalogQuery = {}) {
  const repository = hasPublicSupabaseServerConfig()
    ? new SupabasePlatformRepository()
    : new MockPlatformRepository();

  try {
    return await repository.listCatalog(query);
  } catch (error) {
    console.error("[platform-catalog] No se pudo cargar el catálogo.", error instanceof Error ? error.message : "unknown");
    if (process.env.NODE_ENV === "production") return [];
    return new MockPlatformRepository().listCatalog(query);
  }
}
import { cache } from "react";

export const getPublicSports = cache(async () => {
  const repository = hasPublicSupabaseServerConfig()
    ? new SupabasePlatformRepository()
    : new MockPlatformRepository();
  try {
    return await repository.listSports();
  } catch (error) {
    console.error("[platform-sports] No se pudo cargar el catálogo de deportes.", error instanceof Error ? error.message : "unknown");
    if (process.env.NODE_ENV === "production") return [];
    return new MockPlatformRepository().listSports();
  }
});

export const getPublicSportBySlug = cache(async (slug: string) => {
  const normalized = slug.trim().toLowerCase();
  return (await getPublicSports()).find((sport) => sport.slug === normalized) ?? null;
});
