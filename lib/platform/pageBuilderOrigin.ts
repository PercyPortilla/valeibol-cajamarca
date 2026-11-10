/** Rechaza mutaciones cross-origin; no concede acceso ni sustituye Auth/RLS. */
export function isSameOriginPageBuilderMutation(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  let originHost: string;
  try {
    if (!origin) return false;
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    originHost = parsed.host;
  } catch {
    return false;
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hosts = [request.headers.get("host"), forwardedHost, new URL(request.url).host].filter(Boolean);
  return hosts.includes(originHost) && (!fetchSite || fetchSite === "same-origin");
}
