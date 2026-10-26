export const PLATFORM_ADMIN_BUSINESS_COOKIE = "caxas-platform-business";
export const PLATFORM_ADMIN_BUSINESS_HEADER = "x-platform-business-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validPlatformBusinessId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return UUID_RE.test(normalized) ? normalized : null;
}

export function readPlatformBusinessIdFromDocument() {
  if (typeof document === "undefined") return null;
  const prefix = `${PLATFORM_ADMIN_BUSINESS_COOKIE}=`;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return validPlatformBusinessId(raw ? decodeURIComponent(raw) : null);
}
