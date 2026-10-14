import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/202610140006_phase7_production_hardening.sql");
const edgeMigration = read("supabase/migrations/202610140012_edge_booking_server_auth.sql");
const route = read("app/api/public/reservation-requests/route.ts");
const edge = read("supabase/functions/public-reservation-request/index.ts");
const repository = read("lib/data/repositories/supabaseBookingRepository.ts");
const availabilityService = read("lib/data/availabilityService.ts");
const bookingService = read("lib/data/bookingService.ts");
const pricingService = read("lib/data/publicPricingService.ts");

const checks = [
  ["migración de hardening", migration.includes("public_booking_rate_limits")],
  ["RLS rate limit", migration.includes("alter table public.public_booking_rate_limits enable row level security")],
  ["RPC pública directa revocada", migration.includes("from anon, authenticated") && migration.includes("to service_role")],
  ["proxy server-side", route.includes("PUBLIC_BOOKING_RATE_LIMIT_SECRET") && route.includes("/functions/v1/public-reservation-request")],
  ["Edge usa credencial privilegiada interna", edge.includes("SUPABASE_SERVICE_ROLE_KEY") && edge.includes("SUPABASE_SECRET_KEYS")],
  ["token server-to-server validado por hash", edgeMigration.includes("validate_server_integration_secret") && edge.includes("x-valeibol-server-token") && edge.includes("sha256Hex")],
  ["HMAC irreversible en Edge", edge.includes('name: "HMAC"') && edge.includes("p_fingerprint_hash")],
  ["payload allowlist doble", route.includes("ALLOWED_KEYS") && edge.includes("ALLOWED_KEYS")],
  ["browser usa API interna", repository.includes('fetch("/api/public/reservation-requests"')],
  ["browser no usa RPC de escritura", !repository.includes('client.rpc("create_public_reservation_request"')],
  ["mock solo desarrollo", availabilityService.includes('process.env.NODE_ENV === "production"') && bookingService.includes('process.env.NODE_ENV === "production"')],
  ["pricing no cae a demo en producción", pricingService.includes('process.env.NODE_ENV === "production"') && pricingService.includes('source: "unavailable"')],
  ["Edge no devuelve PII", !edge.includes("customer_id") && !edge.includes("phoneE164: row") && !edge.includes("customerName: row")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log(`Production hardening: ${checks.length}/${checks.length} PASS`);
