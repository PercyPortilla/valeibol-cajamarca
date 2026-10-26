import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20261025133000_block44_business_reschedule_proposals.sql", "utf8");
const adminActions = readFileSync("app/admin/(protected)/actions.ts", "utf8");
const operations = readFileSync("lib/admin/operations.ts", "utf8");
const adminPage = readFileSync("app/admin/(protected)/reservas/page.tsx", "utf8");
const adminProposalUi = readFileSync("components/admin/AdminBusinessRescheduleProposal.tsx", "utf8");
const adminRequestsUi = readFileSync("components/admin/AdminReservationChangeRequests.tsx", "utf8");
const account = readFileSync("app/mi-cuenta/page.tsx", "utf8");
const customerProposalUi = readFileSync("components/account/CustomerBusinessRescheduleProposal.tsx", "utf8");
const notificationMeta = readFileSync("lib/notifications.ts", "utf8");
const auditMeta = readFileSync("lib/admin/reservationAudit.ts", "utf8");
const types = readFileSync("lib/data/supabase/database.types.ts", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");

function functionBody(name: string) {
  return migration.match(new RegExp("create or replace function public\\." + name + "[\\s\\S]*?\\$\\$;", "i"))?.[0] ?? "";
}

test("B44 distingue propuesta del negocio sin crear un lifecycle paralelo", () => {
  assert.match(migration, /alter table public\.reservation_change_requests/);
  assert.match(migration, /initiator_kind text/);
  assert.match(migration, /proposal_note text/);
  assert.match(migration, /initiator_kind in \('customer','business'\)/);
  assert.doesNotMatch(migration, /create table[^\n]*reschedule_proposal/i);
});

test("B44 propuesta owner-admin bloquea reserva antes del change request y no mueve la reserva", () => {
  const fn = functionBody("admin_propose_reservation_reschedule");
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q");
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /phase6_admin_actor\(\)/);
  assert.match(fn, /v_actor\.role not in \('owner','admin'\)/);
  assert.match(fn, /from public\.reservations r[\s\S]*for update/i);
  assert.match(fn, /from public\.reservation_change_requests q[\s\S]*for update/i);
  assert.match(fn, /court_schedule_entries/);
  assert.match(fn, /pg_advisory_xact_lock/);
  assert.match(fn, /reservation_payment_requires_business_reschedule/);
  assert.match(fn, /'business', v_actor\.user_id, v_note/);
  assert.match(fn, /v_request\.initiator_kind = 'business'/);
  assert.match(fn, /v_request\.requested_court_id = p_court_id/);
  assert.match(fn, /return query[\s\S]*v_request\.requested_total_amount/);
  assert.doesNotMatch(fn, /update public\.reservations/i);
});

test("B44 aceptación cliente revalida quote y agenda antes de mover la reserva", () => {
  const fn = functionBody("respond_to_business_reschedule_proposal");
  const reservationLock = fn.indexOf("from public.reservations r");
  const requestLock = fn.indexOf("from public.reservation_change_requests q", fn.indexOf("for update"));
  assert.match(fn, /v_uid uuid := auth\.uid\(\)/);
  assert.match(fn, /q\.user_id = v_uid/);
  assert.match(fn, /q\.initiator_kind = 'business'/);
  assert.ok(reservationLock >= 0 && requestLock > reservationLock);
  assert.match(fn, /phase6_resolve_window/);
  assert.match(fn, /reschedule_quote_changed/);
  assert.match(fn, /court_schedule_entries/);
  assert.match(fn, /update public\.reservations/);
  assert.match(fn, /exception when exclusion_violation/);
  assert.match(fn, /status = 'approved'/);
  assert.match(fn, /resolved_by = v_uid/);
  const rejectIndex = fn.indexOf("if not p_accept then");
  const applicabilityIndex = fn.indexOf("v_reservation.status <> 'confirmed'");
  assert.ok(rejectIndex >= 0 && applicabilityIndex > rejectIndex, "rechazar debe poder cerrar una propuesta aunque el horario original ya haya pasado");
});

test("B44 impide autoaprobar propuesta del negocio desde admin", () => {
  const guard = functionBody("block44_guard_business_proposal_resolution");
  const adminResolver = functionBody("admin_resolve_reservation_change_request");
  assert.match(guard, /old\.initiator_kind = 'business'/);
  assert.match(guard, /auth\.uid\(\) is distinct from old\.user_id/);
  assert.match(guard, /business_reschedule_requires_customer_response/);
  assert.match(migration, /before update of status on public\.reservation_change_requests/);
  assert.match(adminResolver, /v_request\.initiator_kind = 'business'[\s\S]*business_reschedule_requires_customer_response/);
});

test("B44 UI separa quién debe responder y conserva el horario original hasta aceptación", () => {
  assert.match(operations, /"propose_reschedule"/);
  assert.match(adminActions, /admin_propose_reservation_reschedule/);
  assert.match(adminPage, /AdminBusinessRescheduleProposal/);
  assert.match(adminProposalUi, /get_admin_reschedule_courts/);
  assert.match(adminProposalUi, /reserva actual no se moverá/i);
  assert.match(adminRequestsUi, /Esperando respuesta del cliente/i);
  assert.match(adminRequestsUi, /request\.initiator_kind === "business"/);
  assert.match(account, /CustomerBusinessRescheduleProposal/);
  assert.match(account, /request\.initiator_kind === "business"/);
  assert.match(customerProposalUi, /respond_to_business_reschedule_proposal/);
  assert.match(customerProposalUi, /Aceptar propuesta/);
  assert.match(customerProposalUi, /Rechazar/);
});

test("B44 integra notificaciones, auditoría, tipos y runner SQL", () => {
  for (const event of ["reschedule_proposed", "reschedule_proposal_accepted", "reschedule_proposal_rejected"]) {
    assert.match(migration, new RegExp(event));
    assert.match(notificationMeta, new RegExp(event));
    assert.match(auditMeta, new RegExp(event));
    assert.match(types, new RegExp(event));
  }
  assert.match(types, /admin_propose_reservation_reschedule/);
  assert.match(types, /respond_to_business_reschedule_proposal/);
  assert.match(types, /requested_court_name/);
  assert.match(sqlRunner, /platform_business_reschedule_proposals\.sql/);
});
