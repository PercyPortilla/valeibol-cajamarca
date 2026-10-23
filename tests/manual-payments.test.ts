import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261023091715_manual_payments.sql", "utf8");
const adminPage = readFileSync("app/admin/(protected)/pagos/page.tsx", "utf8");
const reservationDialog = readFileSync("components/booking/ReservationDialog.tsx", "utf8");
const accountPage = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const navigation = readFileSync("components/admin/AdminNavigation.tsx", "utf8");

test("pagos manuales no incorporan pasarela ni estados de cobro inventados", () => {
  assert.match(migration, /payment_method as enum \('yape', 'plin', 'cash', 'bank_transfer'\)/i);
  assert.match(migration, /payment_status as enum \('reported', 'verified', 'rejected', 'refunded'\)/i);
  assert.doesNotMatch(migration, /stripe|culqi|mercado.?pago|gateway_charge/i);
});

test("cliente no puede manipular monto ni negocio al reportar pago", () => {
  const report = migration.match(/create or replace function public\.report_my_payment[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(report, /auth\.uid\(\)/i);
  assert.match(report, /v_reservation\.total_amount/i);
  assert.doesNotMatch(report, /p_amount|p_business_id|p_currency/i);
});

test("métodos públicos solo muestran configuraciones activas", () => {
  const publicMethods = migration.match(/create or replace function public\.get_public_payment_methods[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(publicMethods, /pm\.is_active/i);
  assert.match(migration, /false, valueset\.sort_order/i);
});

test("compatibilidad de datos conserva controles históricos sin exponer el módulo de pagos", () => {
  const review = migration.match(/create or replace function public\.admin_review_payment[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(review, /v_actor\.role not in \('owner','admin'\)/i);
  assert.match(review, /p_status not in \('verified','rejected'\)/i);
  assert.match(adminPage, /redirect\("\/admin\/reservas"\)/);
  assert.doesNotMatch(navigation, /\/admin\/pagos/);
  assert.doesNotMatch(reservationDialog, /Opciones de pago manual|reportar el pago/i);
  assert.doesNotMatch(accountPage, /PaymentReportForm|get_my_payments|getPublicPaymentMethods/);
  assert.match(reservationDialog, /Seguimiento por WhatsApp/i);
});
