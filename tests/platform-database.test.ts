import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20261023085123_global_multitenant_schema.sql",
  "utf8",
);
const seed = readFileSync("supabase/seed.sql", "utf8");

test("Bloque 2 mantiene el esquema existente y agrega la capa multi-tenant de forma aditiva", () => {
  assert.match(migration, /create table if not exists public\.sports/i);
  assert.match(migration, /create table if not exists public\.venues/i);
  assert.match(migration, /create table if not exists public\.user_accounts/i);
  assert.match(migration, /alter table public\.courts[\s\S]+add column if not exists venue_id uuid/i);
  assert.match(migration, /add column if not exists sport_id uuid/i);
  assert.doesNotMatch(migration, /drop table\s+public\.(businesses|courts|profiles|customers|reservations)/i);
});

test("roles globales y roles heredados quedan separados sin elevar admin/staff de negocio", () => {
  assert.match(migration, /platform_role as enum \('customer', 'owner', 'admin'\)/i);
  assert.match(migration, /p\.role = 'owner'/i);
  assert.match(migration, /else 'customer'::public\.platform_role/i);
  const backfill = migration.match(/update public\.user_accounts ua[\s\S]*?where ua\.user_id = derived\.user_id;/i)?.[0] ?? "";
  assert.doesNotMatch(backfill, /p\.role = 'admin'[^\n]+then 'admin'/i);
  assert.doesNotMatch(migration, /p\.role = 'staff'[^\n]+then 'admin'/i);
});

test("user_accounts no permite DML directo a authenticated", () => {
  assert.match(migration, /revoke all on public\.sports, public\.user_accounts, public\.venues from anon, authenticated/i);
  assert.match(migration, /grant select on public\.user_accounts, public\.venues to authenticated/i);
  assert.doesNotMatch(migration, /grant\s+(insert|update|delete)[^;]+public\.user_accounts[^;]+authenticated/i);
});

test("todas las nuevas tablas públicas tienen RLS y el catálogo público es sanitizado", () => {
  for (const table of ["sports", "user_accounts", "venues"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /create or replace function public\.get_public_platform_catalog/i);
  assert.match(migration, /grant execute on function public\.get_public_platform_catalog\(text,text\) to anon, authenticated/i);
  assert.doesNotMatch(
    migration.match(/create or replace function public\.get_public_platform_catalog[\s\S]*?\$\$;/i)?.[0] ?? "",
    /customer_phone|internal_note|created_by|email/i,
  );
});

test("seed y capa demo comparten los IDs reales del tenant Valeibol", () => {
  assert.match(seed, /'10000000-0000-4000-8000-000000000001'/);
  assert.match(seed, /'20000000-0000-4000-8000-000000000001'/);
  assert.match(seed, /'30000000-0000-4000-8000-000000000001'/);
  assert.match(seed, /'60000000-0000-4000-8000-000000000001'/);
});

test("nuevas funciones SECURITY DEFINER fijan search_path", () => {
  const definerCount = [...migration.matchAll(/security definer/gi)].length;
  const safePathCount = [...migration.matchAll(/set search_path = public, pg_temp/gi)].length;
  assert.ok(definerCount > 0);
  assert.equal(safePathCount, definerCount);
});
