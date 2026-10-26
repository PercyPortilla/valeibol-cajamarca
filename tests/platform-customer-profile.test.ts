import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025100000_block38_customer_profile.sql", "utf8");
const accountPage = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const form = readFileSync("components/account/CustomerProfileForm.tsx", "utf8");
const dialog = readFileSync("components/booking/ReservationDialog.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");

test("B38 deriva identidad propia y solo modifica nombre/teléfono", () => {
  const fn = migration.match(/create or replace function public\.update_my_customer_profile[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /auth\.uid\(\)/);
  assert.match(fn, /set display_name = v_display_name,[\s\S]*?phone_e164 = v_phone_e164/i);
  assert.doesNotMatch(fn, /p_user_id|p_business_id|set role|set is_active/i);
  assert.match(fn, /invalid_phone_e164/);
});

test("Mi cuenta muestra Mis datos con email solo lectura", () => {
  assert.match(accountPage, /CustomerProfileForm/);
  assert.match(form, /MIS DATOS/);
  assert.match(form, /Email de acceso/);
  assert.match(form, /readOnly/);
  assert.match(form, /update_my_customer_profile/);
});

test("B38 precarga reservas desde perfil sin guardar cambios del formulario", () => {
  assert.match(dialog, /rpc\("get_my_customer_profile"\)/);
  assert.match(dialog, /setName\(profile\.display_name/);
  assert.match(dialog, /setPhone\(profile\.phone_e164/);
  assert.doesNotMatch(dialog, /update_my_customer_profile/);
});

test("tipos B38 están sincronizados", () => {
  assert.match(types, /get_my_customer_profile/);
  assert.match(types, /update_my_customer_profile/);
});

