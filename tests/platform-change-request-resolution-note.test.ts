import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("app/admin/(protected)/actions.ts", "utf8");
const adminUi = readFileSync("components/admin/AdminReservationChangeRequests.tsx", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const cancellationUi = readFileSync("components/account/CustomerReservationCancellationRequest.tsx", "utf8");
const rescheduleUi = readFileSync("components/account/CustomerReservationRescheduleRequest.tsx", "utf8");
const auditPage = readFileSync("app/admin/(protected)/reservas/[id]/historial/page.tsx", "utf8");
const migration52 = readFileSync("supabase/migrations/20261025180000_block52_change_request_resolution_notes.sql", "utf8");
const migration39 = readFileSync("supabase/migrations/20261025103000_block39_confirmed_cancellation_requests.sql", "utf8");
const migration46 = readFileSync("supabase/migrations/20261025150000_block46_customer_change_request_expiration.sql", "utf8");
const runner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

test("B52 reutiliza resolution_note autoritativo y su límite existente", () => {
  assert.match(migration39, /resolution_note text/);
  assert.match(migration39, /char_length\(resolution_note\) <= 500/);
  assert.match(migration46, /p_resolution_note text default null/);
  assert.match(migration46, /resolution_note = v_note/);
  assert.match(migration46, /resolution_kind = 'admin_resolution'/);
  assert.match(migration52, /resolution_note = v_note/);
});

test("B52 idempotencia exige misma decisión y misma nota normalizada", () => {
  const fn = migration52.match(/create or replace function public\.admin_resolve_reservation_change_request[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(fn, /v_request\.resolution_kind = 'admin_resolution'/);
  assert.match(fn, /v_request\.resolution_note is not distinct from v_note/);
  assert.ok(fn.indexOf("resolution_note is not distinct from v_note") < fn.indexOf("change_request_already_resolved"));
});

test("B52 action normaliza y envía la respuesta al RPC en vez de null fijo", () => {
  assert.match(actions, /resolveReservationChangeRequestAction\([\s\S]*resolutionNote: string \| null = null/);
  assert.match(actions, /resolutionNote\.trim\(\)\.replace\(\/\\s\+\/g, " "\)/);
  assert.match(actions, /normalizedNote\.length > 500/);
  assert.match(actions, /p_resolution_note: normalizedNote \|\| null/);
  assert.doesNotMatch(actions, /p_resolution_note: null,[\s\S]*admin_resolve_reservation_change_request/);
});

test("B52 panel admin captura una nota explícitamente visible para el cliente", () => {
  assert.match(adminUi, /Respuesta al cliente \(opcional\)/);
  assert.match(adminUi, /maxLength=\{500\}/);
  assert.match(adminUi, /el cliente podrá verla en Mi cuenta/i);
  assert.match(adminUi, /resolveReservationChangeRequestAction\(requestId, approve, resolutionNotes\[requestId\]/);
});

test("B52 Mi cuenta conecta resolution_note con cancelación y reprogramación", () => {
  assert.match(account, /resolutionNote=\{cancellationRequest\?\.resolution_note \?\? null\}/);
  assert.match(account, /resolutionNote=\{rescheduleRequest\?\.resolution_note \?\? null\}/);
  assert.match(cancellationUi, /Respuesta del negocio/);
  assert.match(cancellationUi, /resolutionKind === "admin_resolution"/);
  assert.match(rescheduleUi, /Respuesta del negocio/);
  assert.match(rescheduleUi, /resolutionKind === "admin_resolution"/);
  assert.match(rescheduleUi, /requestStatus === "approved" && canRequest[\s\S]*businessResponse/);
});

test("B52 historial admin enlaza la nota sin duplicarla en el ledger append-only", () => {
  const auditFn = migration52.match(/create function public\.get_admin_reservation_audit[\s\S]*?\$\$;/i)?.[0] ?? "";
  assert.match(auditFn, /left join public\.reservation_change_requests q/);
  assert.match(auditFn, /q\.business_id = e\.business_id/);
  assert.match(auditFn, /q\.reservation_id = e\.reservation_id/);
  assert.match(auditFn, /when e\.new_request_status in \('approved','rejected'\) then q\.resolution_note/);
  assert.match(auditPage, /Nota de resolución/);
  assert.doesNotMatch(migration52, /alter table public\.reservation_audit_events[\s\S]*resolution_note/i);
});

test("B52 no confunde expiración o retiro con una respuesta administrativa", () => {
  assert.match(cancellationUi, /customer_expiration/);
  assert.match(cancellationUi, /customer_withdrawal/);
  assert.match(rescheduleUi, /customer_expiration/);
  assert.match(rescheduleUi, /customer_withdrawal/);
  assert.match(cancellationUi, /resolutionKind === "admin_resolution" && resolutionNote/);
  assert.match(rescheduleUi, /resolutionKind === "admin_resolution" && resolutionNote/);
});

test("B52 registra contrato SQL de resolution_note", () => {
  assert.match(runner, /platform_change_request_resolution_note\.sql/);
});
