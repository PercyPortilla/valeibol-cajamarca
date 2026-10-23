import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261023091203_customer_accounts_history.sql", "utf8");
const multitenant = readFileSync("supabase/migrations/20261023085123_global_multitenant_schema.sql", "utf8");
const route = readFileSync("app/api/public/reservation-requests/route.ts", "utf8");
const edge = readFileSync("supabase/functions/public-reservation-request/index.ts", "utf8");
const accountPage = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const authForm = readFileSync("components/account/CustomerAuthForm.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");

test("historial cliente deriva identidad exclusivamente desde auth.uid", () => {
  const history = migration.match(/create or replace function public\.get_my_reservations\(\)[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(history, /auth\.uid\(\)/i);
  assert.doesNotMatch(history, /p_user_id/i);
  assert.doesNotMatch(history, /customer_name|phone|notes?/i);
  assert.match(migration, /grant execute on function public\.get_my_reservations\(\) to authenticated/i);
  assert.match(migration, /revoke all on function public\.get_my_reservations\(\) from public, anon/i);
});

test("vínculo reservation→user es server-only", () => {
  assert.match(migration, /link_public_reservation_user\(uuid,uuid\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.link_public_reservation_user\(uuid,uuid\)[\s\S]*to service_role/i);
});

test("navegador no puede inyectar authenticatedUserId", () => {
  const allowedBlock = route.match(/const ALLOWED_KEYS = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? "";
  assert.doesNotMatch(allowedBlock, /authenticatedUserId/);
  assert.match(route, /authenticatedUserId = data\.user\?\.id \?\? null/);
  assert.match(edge, /"authenticatedUserId"/);
  assert.match(edge, /link_public_reservation_user/);
  assert.match(edge, /let accountLinked: boolean \| null = null/);
});

test("reservas guest siguen permitidas y la cuenta no fuerza user_id", () => {
  assert.match(multitenant, /alter table public\.reservations[\s\S]*add column if not exists user_id uuid references public\.user_accounts\(user_id\) on delete set null/i);
  const reservationUserColumn = multitenant.match(/alter table public\.reservations[\s\S]*?;/i)?.[0] ?? "";
  assert.doesNotMatch(reservationUserColumn, /not null/i);
});

test("mi cuenta es dinámica, refresca sesión SSR y distingue error de historial vacío", () => {
  assert.match(accountPage, /export const dynamic = "force-dynamic"/);
  assert.match(proxy, /\/mi-cuenta\/:path\*/);
  assert.match(proxy, /customerAccountPath/);
  assert.match(accountPage, /historyLoadFailed/);
  assert.match(accountPage, /No pudimos cargar tu historial/);
});

test("acceso cliente usa contraseña, callback seguro y feedback accesible sin pagos", () => {
  assert.match(authForm, /signInWithPassword/);
  assert.match(authForm, /signUp/);
  assert.match(authForm, /emailRedirectTo/);
  assert.match(authForm, /aria-pressed/);
  assert.match(authForm, /Mínimo 8 caracteres/);
  assert.doesNotMatch(accountPage, /PaymentReportForm|get_my_payments|reportar pago/i);
  assert.match(accountPage, /Confirmada|Pendiente|Cancelada|Completada/);
});

test("reserva autenticada informa si el vínculo con Mi cuenta falla", () => {
  const bookingTypes = readFileSync("lib/data/repositories/bookingRepository.ts", "utf8");
  const bookingRepo = readFileSync("lib/data/repositories/supabaseBookingRepository.ts", "utf8");
  const dialog = readFileSync("components/booking/ReservationDialog.tsx", "utf8");
  assert.match(bookingTypes, /accountLinked: boolean \| null/);
  assert.match(bookingRepo, /accountLinked: payload\.accountLinked/);
  assert.match(dialog, /La solicitud se creó, pero no quedó vinculada a tu cuenta/);
  assert.match(dialog, /No envíes otra solicitud por el mismo horario/);
  assert.match(dialog, /Referencia: \{result\.requestId\}/);
  assert.doesNotMatch(dialog, /no procesa pagos|reportar el pago/i);
});
