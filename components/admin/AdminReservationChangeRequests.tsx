"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "@/lib/auth";
import { expireBusinessRescheduleProposalAction, expireCustomerChangeRequestAction, resolveReservationChangeRequestAction, withdrawBusinessRescheduleProposalAction } from "@/app/admin/(protected)/actions";

export type AdminReservationChangeRequest = {
  request_id: string;
  reservation_id: string;
  request_type: string;
  request_status: string;
  customer_reason: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
  court_name: string;
  customer_name: string | null;
  customer_phone_e164: string | null;
  start_at: string;
  end_at: string;
  current_total_amount: number | string;
  currency: string;
  requested_court_id: string | null;
  requested_court_name: string | null;
  requested_start_at: string | null;
  requested_end_at: string | null;
  requested_total_amount: number | string | null;
  initiator_kind: "customer" | "business";
  proposal_note: string | null;
  resolution_kind: string | null;
};

export function AdminReservationChangeRequests({ requests, role, timezone, nowIso, pageEnd = false }: { requests: AdminReservationChangeRequest[]; role: AdminRole; timezone: string; nowIso: string; pageEnd?: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingTransition, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const pending = requests.filter((request) => request.request_status === "pending");
  if (!pending.length && !pageEnd) return null;
  const canResolve = role === "owner" || role === "admin";
  const nowMs = new Date(nowIso).getTime();

  function resolve(requestId: string, approve: boolean) {
    if (busyId || pendingTransition) return;
    setBusyId(requestId);
    setMessage(null);
    startTransition(async () => {
      const result = await resolveReservationChangeRequestAction(requestId, approve, resolutionNotes[requestId] ?? "");
      setMessage(result.message);
      setBusyId(null);
      if (result.ok) router.refresh();
    });
  }

  function withdraw(requestId: string) {
    if (busyId || pendingTransition) return;
    setBusyId(requestId);
    setMessage(null);
    startTransition(async () => {
      const result = await withdrawBusinessRescheduleProposalAction(requestId);
      setMessage(result.message);
      setBusyId(null);
      if (result.ok) router.refresh();
    });
  }

  function expire(requestId: string) {
    if (busyId || pendingTransition) return;
    setBusyId(requestId);
    setMessage(null);
    startTransition(async () => {
      const result = await expireBusinessRescheduleProposalAction(requestId);
      setMessage(result.message);
      setBusyId(null);
      if (result.ok) router.refresh();
    });
  }

  function expireCustomer(requestId: string) {
    if (busyId || pendingTransition) return;
    setBusyId(requestId);
    setMessage(null);
    startTransition(async () => {
      const result = await expireCustomerChangeRequestAction(requestId);
      setMessage(result.message);
      setBusyId(null);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="admin-reservation-change-requests" aria-labelledby="change-requests-title">
      <div className="admin-topbar"><div><span className="eyebrow">SOLICITUDES DE CAMBIO</span><h2 id="change-requests-title">Cambios pendientes</h2></div></div>
      {message ? <div className="admin-inline-feedback" role="status">{message}</div> : null}
      {pending.length ? <div className="admin-reservation-list">
        {pending.map((request) => {
          const proposalExpired = request.initiator_kind === "business"
            && (
              new Date(request.start_at).getTime() <= nowMs
              || (request.requested_start_at ? new Date(request.requested_start_at).getTime() <= nowMs : false)
            );
          const customerRequestExpired = request.initiator_kind === "customer"
            && (
              new Date(request.start_at).getTime() <= nowMs
              || (
                request.request_type === "reschedule"
                && (!request.requested_start_at || new Date(request.requested_start_at).getTime() <= nowMs)
              )
            );
          return (
          <article className="admin-reservation-card" key={request.request_id}>
            <div className="admin-reservation-card__head"><div><strong>{request.initiator_kind === "business" ? "Propuesta de reprogramación" : request.request_type === "reschedule" ? "Reprogramación" : "Cancelación"} · {request.court_name}</strong><small>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(request.start_at))}</small></div></div>
            <dl className="admin-reservation-details">
              <div><dt>Cliente</dt><dd>{request.customer_name ?? "Cliente vinculado"}</dd></div>
              <div><dt>{request.initiator_kind === "business" ? "Nota propuesta" : "Motivo"}</dt><dd>{request.initiator_kind === "business" ? request.proposal_note ?? "Sin nota adicional" : request.customer_reason ?? "Sin motivo indicado"}</dd></div>
              {request.request_type === "reschedule" && request.requested_start_at ? <>
                <div><dt>Nuevo horario</dt><dd>{request.requested_court_name ?? "Cancha"} · {new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(request.requested_start_at))}</dd></div>
                <div><dt>Valor estimado</dt><dd>{request.currency} {Number(request.requested_total_amount ?? 0).toFixed(2)} · actual {request.currency} {Number(request.current_total_amount).toFixed(2)}</dd></div>
              </> : null}
            </dl>
            {request.initiator_kind === "customer" && !customerRequestExpired && canResolve ? (
              <label className="field">
                <span className="field__label">Respuesta al cliente (opcional)</span>
                <textarea
                  className="field__control"
                  maxLength={500}
                  value={resolutionNotes[request.request_id] ?? ""}
                  disabled={busyId === request.request_id || pendingTransition}
                  onChange={(event) => setResolutionNotes((current) => ({ ...current, [request.request_id]: event.target.value }))}
                />
                <small>Se guardará junto con la decisión y el cliente podrá verla en Mi cuenta.</small>
              </label>
            ) : null}
            {request.initiator_kind === "business"
              ? <div className="admin-reservation-actions"><small>{proposalExpired ? "La propuesta ya no puede aceptarse por tiempo. La reserva original no fue modificada." : "Esperando respuesta del cliente desde Mi cuenta. La reserva original sigue vigente."}</small>{canResolve ? proposalExpired ? <button className="button button--ghost" type="button" disabled={busyId === request.request_id || pendingTransition} onClick={() => expire(request.request_id)}>{busyId === request.request_id ? "Expirando…" : "Expirar propuesta"}</button> : <button className="button button--ghost" type="button" disabled={busyId === request.request_id || pendingTransition} onClick={() => withdraw(request.request_id)}>{busyId === request.request_id ? "Retirando…" : "Retirar propuesta"}</button> : null}</div>
              : customerRequestExpired
                ? <div className="admin-reservation-actions"><small>La solicitud ya venció por tiempo y no debe aprobarse ni rechazarse como si siguiera vigente.</small>{canResolve ? <button className="button button--ghost" type="button" disabled={busyId === request.request_id || pendingTransition} onClick={() => expireCustomer(request.request_id)}>{busyId === request.request_id ? "Expirando…" : "Expirar solicitud"}</button> : null}</div>
              : canResolve
                ? <div className="admin-reservation-actions"><button className="button button--secondary" type="button" disabled={busyId === request.request_id || pendingTransition} onClick={() => resolve(request.request_id, true)}>{request.request_type === "reschedule" ? "Aprobar reprogramación" : "Aprobar cancelación"}</button><button className="button button--ghost" type="button" disabled={busyId === request.request_id || pendingTransition} onClick={() => resolve(request.request_id, false)}>Rechazar</button></div>
                : <small>Solo OWNER o ADMIN pueden resolver esta solicitud.</small>}
          </article>
          );
        })}
      </div> : <div className="admin-empty"><h3>No hay más solicitudes pendientes en esta página</h3><p>Vuelve al inicio de solicitudes para revisar las más recientes.</p></div>}
    </section>
  );
}

