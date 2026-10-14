import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/202610140006_phase7_production_hardening.sql");
const route = read("app/api/public/reservation-requests/route.ts");
const repository = read("lib/data/repositories/supabaseBookingRepository.ts");

const checks = [
  ["migración de hardening", migration.includes("public_booking_rate_limits")],
  ["RLS rate limit", migration.includes("alter table public.public_booking_rate_limits enable row level security")],
  ["RPC pública directa revocada", migration.includes("from anon, authenticated") && migration.includes("to service_role")],
  ["endpoint server-side", route.includes("PUBLIC_BOOKING_RATE_LIMIT_SECRET") && route.includes("createServiceRoleSupabaseClient")],
  ["HMAC irreversible", route.includes('createHmac("sha256"')],
  ["payload allowlist", route.includes("ALLOWED_KEYS") && route.includes("Object.keys(record)")],
  ["browser usa API interna", repository.includes('fetch("/api/public/reservation-requests"')],
  ["browser no usa RPC de escritura", !repository.includes('client.rpc("create_public_reservation_request"')],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log(`Production hardening: ${checks.length}/${checks.length} PASS`);
