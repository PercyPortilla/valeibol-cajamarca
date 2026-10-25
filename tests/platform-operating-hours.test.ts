import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261024170000_block22_operating_hours_management.sql", "utf8");
const editor = readFileSync("components/admin/AdminCourtHoursEditor.tsx", "utf8");
const manager = readFileSync("components/admin/AdminBusinessStructureManager.tsx", "utf8");
const structurePage = readFileSync("app/admin/(protected)/configuracion/estructura/page.tsx", "utf8");
const inventory = readFileSync("lib/admin/inventory.ts", "utf8");
const databaseTypes = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");

function scheduleFunction() {
  return migration.match(/create or replace function public\.admin_schedule_court_operating_hours[\s\S]*?\$\$;/i)?.[0] ?? "";
}

test("B22 deriva tenant/rol desde auth y no acepta business_id", () => {
  const fn = scheduleFunction();
  assert.match(fn, /phase6_admin_actor\(\)/i);
  assert.match(fn, /v_actor\.role not in \('owner', 'admin'\)/i);
  assert.doesNotMatch(fn.split("returns")[0] ?? "", /p_business_id/i);
  assert.match(fn, /c\.business_id = v_actor\.business_id/i);
});

test("horario regular exige siete días válidos y vigencia futura", () => {
  const fn = scheduleFunction();
  assert.match(fn, /jsonb_array_length\(p_hours\) <> 7/i);
  assert.match(fn, /jsonb_array_elements\(p_hours\)/i);
  assert.match(fn, /coalesce\(jsonb_typeof\(item->'weekday'\), 'null'\) <> 'number'/i);
  assert.match(fn, /coalesce\(jsonb_typeof\(item->'is_open'\), 'null'\) <> 'boolean'/i);
  assert.match(fn, /not \(item \? 'opens_at'\)/i);
  assert.match(fn, /not \(item \? 'closes_at'\)/i);
  assert.match(fn, /coalesce\(jsonb_typeof\(item->'opens_at'\), 'null'\) <> 'string'/i);
  assert.match(fn, /at_least_one_open_day_required/i);
  assert.match(fn, /p_effective_from <= v_today/i);
  assert.match(fn, /operating_hours_effective_date_not_future/i);
});

test("B22 serializa contra booking mediante FOR UPDATE de cancha", () => {
  const fn = scheduleFunction();
  assert.match(fn, /from public\.businesses b[\s\S]*?for update/i);
  assert.match(fn, /from public\.courts c[\s\S]*?for update/i);
  assert.ok(fn.indexOf("from public.businesses b") < fn.indexOf("from public.courts c"));
  assert.match(fn, /v_business\.booking_increment_minutes/i);
  assert.match(fn, /No bloqueamos filas de reservations\/schedule_blocks/i);
  assert.doesNotMatch(fn, /from public\.reservations r[\s\S]*?for update/i);
});

test("B22 no invalida reservas futuras activas", () => {
  const fn = scheduleFunction();
  assert.match(fn, /r\.status in \('pending', 'confirmed'\)/i);
  assert.match(fn, /r\.end_at > now\(\)/i);
  assert.match(fn, /at time zone v_business\.timezone/i);
  assert.match(fn, /local_start::date <> r\.local_end::date/i);
  assert.match(fn, /r\.local_start::time < p\.opens_at/i);
  assert.match(fn, /r\.local_end::time > p\.closes_at/i);
  assert.match(fn, /r\.local_end::time - r\.local_start::time/i);
  assert.match(fn, /v_business\.booking_increment_minutes/i);
  assert.match(fn, /operating_hours_conflict_future_reservations/i);
});

test("B22 protege bloqueos activos futuros", () => {
  const fn = scheduleFunction();
  assert.match(fn, /from public\.schedule_blocks sb/i);
  assert.match(fn, /sb\.status = 'active'/i);
  assert.match(fn, /sb\.end_at > now\(\)/i);
  assert.match(fn, /sb\.local_end::time - sb\.local_start::time/i);
  assert.match(fn, /operating_hours_conflict_future_blocks/i);
});

test("B22 conserva historia y versiones futuras", () => {
  const fn = scheduleFunction();
  assert.match(fn, /oh\.effective_from = p_effective_from/i);
  assert.match(fn, /set is_open = x\.is_open[\s\S]*?configuration_status = 'confirmed'/i);
  assert.match(fn, /set effective_until = p_effective_from - 1/i);
  assert.match(fn, /oh\.effective_from > p_effective_from[\s\S]*?order by oh\.effective_from/i);
  assert.match(fn, /next_row\.effective_from - 1/i);
  assert.doesNotMatch(fn, /delete from public\.operating_hours/i);
});

test("B22 refresca calendarios públicos y mantiene DML encapsulado", () => {
  const fn = scheduleFunction();
  assert.match(fn, /insert into public\.availability_revisions/i);
  assert.match(fn, /revision = public\.availability_revisions\.revision \+ 1/i);
  assert.match(migration, /revoke all on function public\.admin_schedule_court_operating_hours\(uuid,jsonb,date\)[\s\S]*?from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.admin_schedule_court_operating_hours\(uuid,jsonb,date\)[\s\S]*?to authenticated/i);
});

test("estructura administrativa expone horario vigente/futuro sin cambiar su firma", () => {
  assert.match(migration, /'operatingHours'/i);
  assert.match(migration, /oh\.effective_until is null or oh\.effective_until >= \(now\(\) at time zone b\.timezone\)::date/i);
  assert.match(inventory, /operatingHours: AdminInventoryOperatingHour\[\]/);
  assert.match(inventory, /parseOperatingHours/);
  assert.match(databaseTypes, /admin_schedule_court_operating_hours/);
});

test("UX B22 reutiliza estructura, mañana como mínimo y feedback accesible", () => {
  assert.match(manager, /AdminCourtHoursEditor/);
  assert.match(manager, /businessToday=\{businessToday\}/);
  assert.match(structurePage, /businessTodayDateKey\(new Date\(\), context\.timezone\)/);
  assert.match(editor, /const minimumDate = addDays\(businessToday, 1\)/);
  assert.match(editor, /admin_schedule_court_operating_hours/);
  assert.match(editor, /Cambios programados/);
  assert.match(editor, /cierres puntuales del día usa la pizarra de disponibilidad/i);
  assert.match(editor, /role=\{feedback\.kind === "error" \? "alert" : "status"\}/);
  assert.match(editor, /busy \? "Programando…" : "Programar horario"/);
  assert.match(editor, /const \[dirty, setDirty\] = useState\(false\)/);
  assert.match(editor, /if \(!dirty\) setHours\(weekForDate\(court, effectiveFrom\)\)/);
});

test("B22 conserva targets táctiles y responsive", () => {
  assert.match(styles, /\.admin-court-hours__date \.field__control,[\s\S]*?\.admin-court-hours__actions \.button \{ min-height: 44px; \}/i);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.admin-court-hours__summary \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/i);
  assert.match(styles, /\.admin-court-hours__actions \.button \{ width: 100%; \}/i);
});
