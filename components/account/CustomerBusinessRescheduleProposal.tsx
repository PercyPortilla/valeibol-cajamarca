"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import { formatMoney } from "@/lib/booking";

function formatDateTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function CustomerBusinessRescheduleProposal({
  requestId,
  currentCourtName,
  currentStartAt,
  currentEndAt,
  requestedCourtName,
  requestedStartAt,
  requestedEndAt,
  requestedTotalAmount,
  currency,
  proposalNote,
  timezone,
}: {
  requestId: string;
  currentCourtName: string;
  currentStartAt: string;
  currentEndAt: string;
  requestedCourtName: string | null;
  requestedStartAt: string | null;
  requestedEndAt: string | null;
  requestedTotalAmount: number | string | null;
  currency: string;
  proposalNote: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function respond(accept: boolean) {
    if (busy) return;
    setBusy(accept ? "accept" : "reject");
    setMessage(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("respond_to_business_reschedule_proposal", {
        p_request_id: requestId,
        p_accept: accept,
      });
      if (error) {
        const normalized = error.message.toLowerCase();
        setMessage(
          normalized.includes("slot_unavailable")
            ? "El horario propuesto dejó de estar disponible. Puedes rechazar la propuesta para conservar tu horario actual."
            : normalized.includes("reschedule_quote_changed")
              ? "La tarifa del horario propuesto cambió. El negocio debe enviarte una nueva propuesta."
              : normalized.includes("reservation_payment_requires_business_reschedule")
                ? "Esta propuesta ya no puede aplicarse automáticamente. Contacta al negocio antes de aceptar."
                : normalized.includes("change_request_already_resolved")
                  ? "La propuesta ya fue respondida, retirada o expirada por el negocio. Actualiza la página."
                  : "No pudimos registrar tu respuesta. Actualiza la página e inténtalo nuevamente.",
        );
        return;
      }
      setMessage(accept ? "Propuesta aceptada. Tu reserva ya tiene el nuevo horario." : "Propuesta rechazada. Tu reserva original se mantiene.");
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con el servicio de reservas.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="account-business-proposal" aria-label="Propuesta de reprogramación del negocio">
      <strong>El negocio propone cambiar tu horario</strong>
      <p>Tu reserva actual se mantiene mientras decides.</p>
      <dl>
        <div><dt>Actual</dt><dd>{currentCourtName} · {formatDateTime(currentStartAt, timezone)}–{new Intl.DateTimeFormat("es-PE", { timeStyle: "short", timeZone: timezone }).format(new Date(currentEndAt))}</dd></div>
        <div><dt>Propuesta</dt><dd>{requestedCourtName ?? "Cancha"} · {requestedStartAt ? formatDateTime(requestedStartAt, timezone) : "Horario no disponible"}{requestedEndAt ? `–${new Intl.DateTimeFormat("es-PE", { timeStyle: "short", timeZone: timezone }).format(new Date(requestedEndAt))}` : ""}</dd></div>
        {requestedTotalAmount !== null ? <div><dt>Nuevo valor</dt><dd>{formatMoney(Number(requestedTotalAmount), currency)}</dd></div> : null}
      </dl>
      {proposalNote ? <p><strong>Nota del negocio:</strong> {proposalNote}</p> : null}
      <div className="account-reservation-actions">
        <button className="button button--primary" type="button" disabled={Boolean(busy)} onClick={() => void respond(true)}>{busy === "accept" ? "Aceptando…" : "Aceptar propuesta"}</button>
        <button className="button button--ghost" type="button" disabled={Boolean(busy)} onClick={() => void respond(false)}>{busy === "reject" ? "Rechazando…" : "Rechazar"}</button>
      </div>
      {message ? <p className="account-withdrawal__feedback" role="status">{message}</p> : null}
    </section>
  );
}
