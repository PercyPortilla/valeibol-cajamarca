export const LOCAL_DEV_ADMIN_COOKIE = "valeibol_local_admin";

const LOCAL_DEV_ADMIN_USERNAME = "admin";
const LOCAL_DEV_ADMIN_PASSWORD = "12345";

export function isLocalDevHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

export function hostnameFromHostHeader(host: string | null | undefined) {
  if (!host) return "";
  const normalized = host.trim().toLowerCase();
  if (normalized.startsWith("[::1]")) return "[::1]";
  return normalized.split(":")[0] ?? "";
}

export function isLocalDevAdminAllowed(input: { nodeEnv?: string; hostname: string }) {
  return input.nodeEnv !== "production" && isLocalDevHostname(input.hostname);
}

export function validateLocalDevAdminCredentials(input: {
  nodeEnv?: string;
  hostname: string;
  username: string;
  password: string;
}) {
  return (
    isLocalDevAdminAllowed(input) &&
    input.username.trim() === LOCAL_DEV_ADMIN_USERNAME &&
    input.password === LOCAL_DEV_ADMIN_PASSWORD
  );
}

