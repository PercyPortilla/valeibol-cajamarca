import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repository = readFileSync("lib/data/repositories/supabaseBookingRepository.ts", "utf8");
const route = readFileSync("app/api/public/reservation-requests/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/202610140006_phase7_production_hardening.sql", "utf8");

test("el navegador ya no ejecuta directamente la RPC de escritura pública", () => {
  assert.equal(repository.includes('client.rpc("create_public_reservation_request"'), false);
  assert.equal(repository.includes('fetch("/api/public/reservation-requests"'), true);
});

test("el endpoint público rechaza campos autoritativos manipulables", () => {
  for (const forbidden of ["businessId", "hourlyRate", "totalAmount", "status", "role", "createdBy"]) {
    assert.equal(route.includes(`"${forbidden}",`), false);
  }
  assert.match(route, /Object\.keys\(record\).*ALLOWED_KEYS/);
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
  assert.match(route, /createHmac\("sha256"/);
  assert.match(migration, /fingerprint_hash text not null/);
  assert.equal(migration.includes("ip_address"), false);
});
