import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025093000_block37_customer_reservation_claim.sql", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const claimForm = readFileSync("components/account/CustomerReservationClaimForm.tsx", "utf8");
const dialog = readFileSync("components/booking/ReservationDialog.tsx", "utf8");
const bookingTypes = readFileSync("lib/data/repositories/bookingRepository.ts", "utf8");
const bookingRepo = readFileSync("lib/data/repositories/supabaseBookingRepository.ts", "utf8");
const dbTypes = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B37 deriva usuario desde auth.uid y usa request_token secreto como prueba de posesión", () => {
  const fn = migration.match(/create or replace function public\.claim_public_reservation[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /auth\.uid\(\)/);
  assert.match(fn, /r\.request_token = p_request_token/i);
  assert.match(fn, /r\.source = 'public_web'/i);
  assert.match(fn, /for update/i);
  assert.doesNotMatch(fn, /p_user_id/i);
});

test("B37 no permite apropiarse de una reserva ya vinculada a otra cuenta", () => {
  const fn = migration.match(/create or replace function public\.claim_public_reservation[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /v_reservation\.user_id is not null and v_reservation\.user_id <> v_user_id/i);
  assert.match(fn, /reservation_claim_invalid/i);
  assert.match(fn, /v_reservation\.user_id is null[\s\S]*?set user_id = v_user_id/i);
  assert.match(migration, /revoke all on function public\.claim_public_reservation\(uuid\) from public, anon/i);
  assert.match(migration, /grant execute on function public\.claim_public_reservation\(uuid\) to authenticated/i);
});

test("booking separa ID público y código secreto de recuperación", () => {
  assert.match(bookingTypes, /recoveryCode: string \| null/);
  assert.match(bookingRepo, /payload\.accountLinked === true \? null : request\.requestToken/);
  assert.match(dialog, /ID de solicitud/);
  assert.match(dialog, /Código secreto de recuperación/);
  assert.match(dialog, /result\.recoveryCode/);
  assert.match(dialog, /crypto\.randomUUID/);
  assert.doesNotMatch(dialog, /Math\.random/);
});

test("Mi cuenta reclama solo por token autenticado y nunca envía user id", () => {
  assert.match(account, /CustomerReservationClaimForm/);
  assert.match(claimForm, /rpc\("claim_public_reservation"/);
  assert.match(claimForm, /p_request_token: normalized/);
  assert.doesNotMatch(claimForm, /userId|user_id|businessId/i);
  assert.match(claimForm, /ID público de la solicitud no sirve/i);
});

test("tipos y SQL runner incluyen B37", () => {
  assert.match(dbTypes, /claim_public_reservation/);
  assert.match(sqlRunner, /platform_customer_reservation_claim\.sql/);
});

