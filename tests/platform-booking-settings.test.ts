import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261024180000_block23_booking_increment_management.sql", "utf8");
const operatingHoursMigration = readFileSync("supabase/migrations/20261024170000_block22_operating_hours_management.sql", "utf8");
const manager = readFileSync("components/admin/AdminBusinessStructureManager.tsx", "utf8");
const inventoryService = readFileSync("lib/data/inventoryService.ts", "utf8");
const inventoryTypes = readFileSync("lib/admin/inventory.ts", "utf8");
const availabilityRepository = readFileSync("lib/data/repositories/supabaseAvailabilityRepository.ts", "utf8");
const availability = readFileSync("lib/availability.ts", "utf8");
const databaseTypes = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");

function updateFunction() {
  return migration.match(/create or replace function public\.admin_update_booking_increment[\s\S]*?\$\$;/i)?.[0] ?? "";
}

test("B23 deriva tenant y rol desde auth sin business_id del navegador", () => {
  const fn = updateFunction();
  assert.match(fn, /phase6_admin_actor\(\)/i);
  assert.match(fn, /v_actor\.role not in \('owner', 'admin'\)/i);
  assert.doesNotMatch(fn.split("returns")[0] ?? "", /p_business_id/i);
  assert.match(fn, /b\.id = v_actor\.business_id/i);
});

test("B23 valida únicamente incrementos compatibles con la constraint existente", () => {
  const fn = updateFunction();
  assert.match(fn, /p_booking_increment_minutes < 15/i);
  assert.match(fn, /p_booking_increment_minutes > 240/i);
  assert.match(fn, /mod\(1440, p_booking_increment_minutes\) <> 0/i);
  assert.match(fn, /invalid_booking_increment/i);
});

test("B23 usa business FOR UPDATE como barrera de serialización", () => {
  const fn = updateFunction();
  assert.match(fn, /from public\.businesses b[\s\S]*?for update/i);
  assert.match(fn, /No se bloquean reservation\/schedule_blocks/i);
  assert.doesNotMatch(fn, /from public\.reservations r[\s\S]*?for update/i);
  assert.doesNotMatch(fn, /from public\.schedule_blocks sb[\s\S]*?for update/i);
});

test("B22 y B23 comparten business lock para evitar write-skew", () => {
  const b22 = operatingHoursMigration.match(/create or replace function public\.admin_schedule_court_operating_hours[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(b22, /from public\.businesses b[\s\S]*?for update/i);
  assert.match(b22, /from public\.courts c[\s\S]*?for update/i);
  assert.ok(b22.indexOf("from public.businesses b") < b22.indexOf("from public.courts c"));
  assert.match(b22, /v_business\.booking_increment_minutes/i);
  assert.doesNotMatch(b22, /v_actor\.booking_increment_minutes/i);
});

test("B23 protege reservas futuras con tiempo local y horario efectivo", () => {
  const fn = updateFunction();
  assert.match(fn, /r\.status in \('pending', 'confirmed'\)/i);
  assert.match(fn, /r\.start_at > now\(\)/i);
  assert.match(fn, /at time zone v_business\.timezone/i);
  assert.match(fn, /from public\.operating_hours oh/i);
  assert.match(fn, /local\.local_end::time - local\.local_start::time/i);
  assert.match(fn, /local\.local_start::time - hours\.opens_at/i);
  assert.match(fn, /booking_increment_conflict_future_reservations/i);
});

test("B23 protege bloqueos futuros activos", () => {
  const fn = updateFunction();
  assert.match(fn, /from public\.schedule_blocks sb/i);
  assert.match(fn, /sb\.status = 'active'/i);
  assert.match(fn, /sb\.start_at > now\(\)/i);
  assert.match(fn, /booking_increment_conflict_future_blocks/i);
});

test("B23 actualiza setting y refresca calendarios abiertos", () => {
  const fn = updateFunction();
  assert.match(fn, /set booking_increment_minutes = p_booking_increment_minutes/i);
  assert.match(fn, /insert into public\.availability_revisions/i);
  assert.match(fn, /revision = public\.availability_revisions\.revision \+ 1/i);
});

test("RPCs B23 mantienen DML encapsulado y lectura para staff autenticado", () => {
  assert.match(migration, /revoke all on function public\.get_admin_booking_settings\(\) from public, anon, authenticated/i);
  assert.match(migration, /revoke all on function public\.admin_update_booking_increment\(smallint\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.get_admin_booking_settings\(\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.admin_update_booking_increment\(smallint\) to authenticated/i);
});

test("estructura admin carga y muestra el incremento real del tenant", () => {
  assert.match(inventoryService, /client\.rpc\("get_admin_booking_settings"\)/);
  assert.match(inventoryService, /bookingIncrementMinutes: bookingSettings\.booking_increment_minutes/);
  assert.match(inventoryTypes, /bookingIncrementMinutes: number/);
  assert.match(manager, /Intervalo de reserva/);
  assert.match(manager, /structure\.bookingIncrementMinutes/);
  assert.match(manager, /admin_update_booking_increment/);
  assert.match(manager, /booking_increment_conflict_future_reservations/);
  assert.match(manager, /booking_increment_conflict_future_blocks/);
  assert.match(manager, /setBookingIncrement\(String\(structure\.bookingIncrementMinutes\)\)/);
  assert.doesNotMatch(manager, /\[structure\.bookingIncrementMinutes, bookingBusy\]/);
});

test("agenda pública usa get_public_booking_context como fuente de granularidad", () => {
  assert.match(availabilityRepository, /client\.rpc\("get_public_booking_context"/);
  assert.match(availabilityRepository, /bookingContext\?\.booking_increment_minutes/);
  assert.match(availabilityRepository, /buildCalendarDaysFromOperatingDays[\s\S]*?bookingIncrementMinutes/);
  assert.match(availability, /slotMinutes: number = businessConfig\.availability\.slotMinutes/);
  assert.match(availability, /buildSlotsFromOperatingDay\(day, timeZone, slotMinutes\)/);
});

test("tipos, feedback accesible y targets B23 quedan cubiertos", () => {
  assert.match(databaseTypes, /get_admin_booking_settings/);
  assert.match(databaseTypes, /admin_update_booking_increment/);
  assert.match(manager, /<FeedbackMessage feedback=\{bookingFeedback\}/);
  assert.match(manager, /bookingBusy \? "Actualizando…" : "Actualizar intervalo"/);
  assert.match(styles, /\.admin-booking-setting \.field__control,[\s\S]*?min-height: 44px/i);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.admin-booking-setting \{ grid-template-columns: 1fr; \}/i);
});
