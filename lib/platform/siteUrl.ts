function normalizeSiteUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveSiteUrl() {
  const explicit = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (explicit) return explicit;

  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProductionUrl) return normalizeSiteUrl(`https://${vercelProductionUrl.replace(/\/$/, "")}`);

  return null;
}

export function absoluteSiteUrl(pathname: string) {
  const siteUrl = resolveSiteUrl();
  if (!siteUrl) return null;
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${siteUrl}${normalized === "/" ? "" : normalized}`;
}
