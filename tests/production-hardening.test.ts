import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repository = readFileSync("lib/data/repositories/supabaseBookingRepository.ts", "utf8");
const route = readFileSync("app/api/public/reservation-requests/route.ts", "utf8");
const edge = readFileSync("supabase/functions/public-reservation-request/index.ts", "utf8");
const migration = readFileSync("supabase/migrations/202610140006_phase7_production_hardening.sql", "utf8");
const edgeMigration = readFileSync("supabase/migrations/202610140012_edge_booking_server_auth.sql", "utf8");

test("el navegador ya no ejecuta directamente la RPC de escritura pública", () => {
  assert.equal(repository.includes('client.rpc("create_public_reservation_request"'), false);
  assert.equal(repository.includes('fetch("/api/public/reservation-requests"'), true);
});

test("el endpoint público rechaza campos autoritativos manipulables", () => {
  for (const forbidden of ["businessId", "hourlyRate", "totalAmount", "status", "role", "createdBy"]) {
    assert.equal(route.includes(`"${forbidden}",`), false);
  }
  assert.match(route, /Object\.keys\(record\).*ALLOWED_KEYS/);
  assert.match(edge, /Object\.keys\(record\).*ALLOWED_KEYS/);
});

test("la escritura directa queda revocada para anon/authenticated", () => {
  assert.match(
    migration,
    /revoke all on function public\.create_public_reservation_request[\s\S]*from anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.create_public_reservation_request[\s\S]*to service_role/i,
  );
});

test("el rate limit persiste solo un HMAC y no una IP en claro", () => {
  assert.match(edge, /HMAC/);
  assert.match(edge, /p_fingerprint_hash/);
  assert.match(migration, /fingerprint_hash text not null/);
  assert.equal(migration.includes("ip_address"), false);
});

test("Vercel no necesita service_role para crear reservas", () => {
  assert.equal(route.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(route.includes("createServiceRoleSupabaseClient"), false);
  assert.match(route, /x-valeibol-server-token/);
  assert.match(route, /functions\/v1\/public-reservation-request/);
});

test("el secreto compartido se valida por hash almacenado fuera del esquema público", () => {
  assert.match(edgeMigration, /private\.server_integration_secrets/);
  assert.match(edgeMigration, /validate_server_integration_secret/);
  assert.match(edge, /sha256Hex/);
  assert.equal(edgeMigration.includes("PUBLIC_BOOKING_RATE_LIMIT_SECRET"), false);
});
