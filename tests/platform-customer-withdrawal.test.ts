import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025060000_block30_customer_pending_withdrawal.sql", "utf8");
const sqlTest = readFileSync("supabase/tests/platform_customer_withdrawal.sql", "utf8");
const accountPage = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const actions = readFileSync("components/account/CustomerReservationActions.tsx", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const styles = readFileSync("app/styles/globals-5.css", "utf8");

test("B30 deriva identidad del cliente y serializa el retiro sobre la reserva propia", () => {
  assert.match(migration, /withdraw_my_pending_reservation\(p_reservation_id uuid\)/i);
  assert.match(migration, /v_uid uuid := auth\.uid\(\)/i);
  assert.match(migration, /ua\.user_id = v_uid[\s\S]*ua\.is_active/i);
  assert.match(migration, /r\.id = p_reservation_id[\s\S]*r\.user_id = v_uid[\s\S]*for update/i);
  assert.doesNotMatch(migration, /p_user_id|p_business_id/i);
});

test("B30 solo retira PENDING futuro sin pago abierto y conserva idempotencia", () => {
  assert.match(migration, /v_reservation\.status = 'cancelled'[\s\S]*return query/i);
  assert.match(migration, /v_reservation\.status <> 'pending'/i);
  assert.match(migration, /v_reservation\.start_at <= now\(\)/i);
  assert.match(migration, /public\.reservation_payments[\s\S]*p\.status in \('reported', 'verified'\)/i);
  assert.match(migration, /v_reservation\.source <> 'public_web'/i);
  assert.match(migration, /set status = 'cancelled'[\s\S]*last_modified_by = v_uid[\s\S]*status_changed_at = now\(\)/i);
});

test("B30 deriva can_withdraw en servidor sin exponer el ledger de pagos", () => {
  assert.match(migration, /create function public\.get_my_reservations\(\)/i);
  assert.match(migration, /r\.status = 'pending'[\s\S]*r\.source = 'public_web'[\s\S]*r\.start_at > now\(\)/i);
  assert.match(migration, /not exists \([\s\S]*public\.reservation_payments rp[\s\S]*rp\.status in \('reported', 'verified'\)/i);
  assert.match(migration, /as can_withdraw/i);
  assert.match(types, /get_my_reservations:[\s\S]*can_withdraw: boolean/);
});

test("B30 mantiene tablas cerradas y expone solo la RPC authenticated", () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public, pg_temp/i);
  assert.match(migration, /revoke all on function public\.withdraw_my_pending_reservation\(uuid\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.withdraw_my_pending_reservation\(uuid\) to authenticated/i);
  assert.match(sqlTest, /usuario no debe retirar reserva ajena/i);
  assert.match(sqlTest, /pago reported debe bloquear retiro/i);
  assert.match(sqlTest, /pago verified debe bloquear retiro/i);
  assert.match(sqlTest, /pago rejected no debe bloquear retiro/i);
  assert.match(sqlTest, /pago refunded no debe bloquear retiro/i);
  assert.match(sqlTest, /retiro debe liberar disponibilidad vía trigger/i);
});

test("Mi cuenta ofrece retiro solo para PENDING futuro con confirmación accesible", () => {
  assert.match(accountPage, /CustomerReservationActions/);
  assert.match(accountPage, /reservation\.can_withdraw/);
  assert.doesNotMatch(accountPage, /Date\.now\(\)/);
  assert.match(actions, /client\.rpc\("withdraw_my_pending_reservation"/);
  assert.match(actions, /aria-expanded=\{confirming\}/);
  assert.match(actions, /aria-controls=\{confirmationId\}/);
  assert.match(actions, /¿Retirar esta solicitud pendiente\?/);
  assert.match(actions, /role="alert"/);
  assert.match(actions, /role="status"/);
  assert.match(actions, /queueMicrotask\(\(\) => triggerRef\.current\?\.focus\(\)\)/);
});

test("B30 sincroniza tipos y conserva targets táctiles/responsive", () => {
  assert.match(types, /withdraw_my_pending_reservation:[\s\S]*p_reservation_id: string[\s\S]*reservation_status: ReservationStatus/);
  assert.match(styles, /\.account-withdrawal__trigger \{[^}]*min-height: 44px/);
  assert.match(styles, /\.account-withdrawal__confirm \.button \{[^}]*min-height: 44px/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*?\.account-withdrawal \{ width: 100%; \}/);
  assert.match(styles, /\.account-withdrawal__danger \{[^}]*background: #9e3541/);
});
