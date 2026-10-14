import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/202610140001_phase3_core.sql");
const seed = read("supabase/seed.sql");
const calendar = read("components/availability/AvailabilityCalendar.tsx");
const config = read("config/business.ts");
const repository = read("lib/data/repositories/supabaseAvailabilityRepository.ts");
const browserClient = read("lib/data/supabase/browser.ts");
const envExample = read(".env.example");
const publicSource = [calendar, repository].join("\n");

for (const forbidden of ["Percy Portilla", "Mery", "ACDM", "DOC", "customerName", "cliente_nombre"]) {
  assert.equal(publicSource.includes(forbidden), false, `No debe aparecer dato/nombre privado: ${forbidden}`);
}

for (const table of [
  "businesses",
  "courts",
  "profiles",
  "operating_hours",
  "pricing_rules",
  "customers",
  "reservations",
  "schedule_blocks",
  "court_schedule_entries",
]) {
  assert.match(migration, new RegExp(`create table public\\.${table}\\b`), `Falta tabla ${table}`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `Falta RLS en ${table}`);
}

assert.match(migration, /exclude using gist[\s\S]*tstzrange\(start_at, end_at, '\[\)'\)[\s\S]*blocks_availability/);
assert.match(migration, /sync_reservation_schedule_entry/);
assert.match(migration, /sync_block_schedule_entry/);
assert.match(migration, /get_public_availability/);
assert.match(migration, /revoke all on public\.customers[\s\S]*from anon|revoke all on public\.businesses[\s\S]*public\.customers[\s\S]*from anon/);
assert.match(migration, /grant execute on function public\.get_public_availability\(text, date, date\) to anon, authenticated/);

for (const pii of ["full_name", "phone_e164", "internal_notes", "customer_id", "created_by"]) {
  const rpcBody = migration.slice(migration.indexOf("create or replace function public.get_public_availability"), migration.indexOf("create or replace function public.get_public_business_config"));
  assert.equal(rpcBody.includes(`'${pii}'`), false, `RPC pública no debe serializar ${pii}`);
}

assert.match(config, /timezone: "America\/Lima"/);
assert.match(config, /withoutLights: 35/);
assert.match(config, /withLights: 60/);
assert.match(config, /scheduleSource: "mock-provisional"/);
assert.match(calendar, /createPublicAvailabilityRepository/);
assert.match(calendar, /Modo demostración|sourceLabel/);
assert.match(repository, /get_public_availability/);
assert.match(browserClient, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
assert.equal(browserClient.includes("SERVICE_ROLE"), false, "El cliente browser no debe conocer service-role");
assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(envExample, /NO versionar ni exponer/);
assert.equal(seed.includes("insert into public.customers"), false, "El seed no debe inventar clientes");
assert.equal(seed.includes("insert into public.reservations"), false, "El seed no debe inventar reservas");

console.log("QA Fase 3: PASS");
console.log("- esquema base y RLS presentes");
console.log("- ledger único con exclusión anti-solapamiento detectado");
console.log("- RPC pública sanitizada y cliente browser sin service-role");
console.log("- tarifas 35/60 y America/Lima preservadas");
console.log("- fallback mock-provisional explícito");
console.log("- seed sin clientes ni reservas inventadas");
