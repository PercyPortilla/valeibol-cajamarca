import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025044257_block28_safe_structure_corrections.sql", "utf8");
const manager = readFileSync("components/admin/AdminBusinessStructureManager.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");

test("B28 deriva tenant/rol y exige negocio provisional", () => {
  for (const name of ["admin_update_venue_slug", "admin_update_court_structure"]) {
    const fn = migration.match(new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`, "i"))?.[0] ?? "";
    assert.match(fn, /phase6_admin_actor\(\)/i, name);
    assert.match(fn, /role not in \('owner', 'admin'\)/i, name);
    assert.match(fn, /configuration_status <> 'provisional'/i, name);
    assert.doesNotMatch(fn.split("returns")[0] ?? "", /p_business_id/i, name);
  }
});

test("B28 no permite reescribir historia de cancha", () => {
  const fn = migration.match(/create or replace function public\.admin_update_court_structure[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /court_must_be_inactive_for_structure_correction/i);
  assert.match(fn, /from public\.reservations r[\s\S]*?court_structure_change_blocked_by_reservation_history/i);
  assert.match(fn, /from public\.schedule_blocks sb[\s\S]*?court_structure_change_blocked_by_schedule_history/i);
  assert.match(fn, /target_venue_not_found_or_inactive/i);
  assert.match(fn, /target_sport_not_found_or_inactive/i);
  assert.match(fn, /insert into public\.availability_revisions/i);
  assert.doesNotMatch(fn, /delete from public\.(reservations|schedule_blocks|courts)/i);
});

test("B28 mantiene DML cerrado y solo expone RPC autenticadas", () => {
  assert.match(migration, /revoke all on function public\.admin_update_venue_slug\(uuid,text\) from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.admin_update_court_structure\(uuid,uuid,uuid,text\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.admin_update_venue_slug\(uuid,text\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.admin_update_court_structure\(uuid,uuid,uuid,text\) to authenticated/i);
});

test("UI B28 permite corregir slug de sede y estructura de cancha con feedback claro", () => {
  assert.match(manager, /admin_update_venue_slug/);
  assert.match(manager, /admin_update_court_structure/);
  assert.match(manager, /court_structure_change_blocked_by_reservation_history/);
  assert.match(manager, /court_structure_change_blocked_by_schedule_history/);
  assert.match(manager, /Retira el negocio de publicación/);
  assert.match(manager, /Desactiva esta cancha antes de corregir su estructura/);
  assert.match(manager, /Si ya existen reservas o bloqueos históricos/);
});

test("UI B28 solo habilita corrección con tenant provisional e inventario inactivo", () => {
  assert.match(manager, /structure\.configurationStatus === "provisional"/);
  assert.match(manager, /const correctionEnabled = canCorrectStructure && !court\.isActive/);
  assert.match(manager, /disabled=\{!correctionEnabled \|\| structureBusy/);
  assert.match(manager, /venues\.map\(\(venue\)/);
  assert.match(manager, /sportOptions\.map\(\(sport\)/);
});

test("tipos Supabase y responsive incluyen B28", () => {
  assert.match(types, /admin_update_venue_slug:/);
  assert.match(types, /admin_update_court_structure:/);
  assert.match(styles, /\.admin-structure-correction__grid--court/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*\.admin-structure-correction__grid--court \{ grid-template-columns: 1fr; \}/i);
  assert.match(styles, /\.admin-structure-correction__grid \.button \{ min-height: 44px; \}/i);
});
