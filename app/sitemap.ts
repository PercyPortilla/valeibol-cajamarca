import type { MetadataRoute } from "next";
import { getPublicPlatformCatalog, getPublicSports } from "@/lib/data/platformService";
import { groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";
import { resolveSiteUrl } from "@/lib/platform/siteUrl";
import { getSportLandingPath } from "@/lib/platform/sportLanding";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  if (!siteUrl) return [];

  const [catalog, sports] = await Promise.all([getPublicPlatformCatalog(), getPublicSports()]);
  const sportSlugs = new Set(catalog.map((item) => item.sportSlug));

  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: `${siteUrl}/buscar`, changeFrequency: "daily", priority: 0.9 },
    ...sports.flatMap((sport) => sportSlugs.has(sport.slug)
      ? [{ url: `${siteUrl}${getSportLandingPath(sport.slug)}`, changeFrequency: "daily" as const, priority: 0.8 }]
      : []),
    { url: `${siteUrl}/complejo/valeibol-cajamarca`, changeFrequency: "daily", priority: 0.9 },
  ];

  const businesses = groupCatalogByBusiness(catalog);
  const complexEntries: MetadataRoute.Sitemap = businesses.map((business) => ({
    url: `${siteUrl}/complejo/${encodeURIComponent(business.slug)}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...new Map([...baseEntries, ...complexEntries].map((entry) => [entry.url, entry])).values()];
}
