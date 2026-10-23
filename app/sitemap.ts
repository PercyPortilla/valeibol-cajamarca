import type { MetadataRoute } from "next";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";

function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionUrl) return `https://${vercelProductionUrl.replace(/\/$/, "")}`;

  return null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = resolveSiteUrl();
  if (!siteUrl) return [];

  const baseEntries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: `${siteUrl}/buscar`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/voley`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/futbol`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/complejo/valeibol-cajamarca`, changeFrequency: "daily", priority: 0.9 },
  ];

  const businesses = groupCatalogByBusiness(await getPublicPlatformCatalog());
  const complexEntries: MetadataRoute.Sitemap = businesses.map((business) => ({
    url: `${siteUrl}/complejo/${encodeURIComponent(business.slug)}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...new Map([...baseEntries, ...complexEntries].map((entry) => [entry.url, entry])).values()];
}
