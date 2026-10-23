import type { MetadataRoute } from "next";

function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionUrl) return `https://${vercelProductionUrl.replace(/\/$/, "")}`;

  return null;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  if (!siteUrl) return [];

  return [
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
}
