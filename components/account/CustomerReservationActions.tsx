"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

function withdrawalErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("reservation_payment_requires_business_cancellation")) {
    return "Esta solicitud tiene un pago reportado o verificado. Coordina la cancelación directamente con el negocio para conservar la trazabilidad del pago.";
  }
  if (normalized.includes("reservation_not_withdrawable")) {
    return "La solicitud ya no está pendiente. Si fue confirmada, coordina cualquier cancelación directamente con el negocio.";
  }
  if (normalized.includes("reservation_withdrawal_window_closed")) {
    return "Este horario ya comenzó. La solicitud no puede retirarse desde Mi cuenta.";
  }
  if (normalized.includes("reservation_not_found")) {
    return "No encontramos esta solicitud en tu cuenta. Actualiza la página para revisar su estado.";
  }
  return "No pudimos retirar la solicitud. Actualiza la página e inténtalo nuevamente.";
}

export function CustomerReservationActions({ reservationId, businessName }: { reservationId: string; businessName: string }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmationId = `withdraw-reservation-${reservationId}`;
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function withdraw() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const client = createPublicBrowserSupabaseClient();
        const { error } = await client.rpc("withdraw_my_pending_reservation", { p_reservation_id: reservationId });
        if (error) throw error;
        setConfirming(false);
        setFeedback({ tone: "success", text: "Solicitud retirada. Ya no bloquea ese horario." });
        router.refresh();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const text = withdrawalErrorMessage(detail);
        setFeedback({ tone: "error", text });
        if (/reservation_not_withdrawable|reservation_withdrawal_window_closed|reservation_not_found|reservation_payment_requires_business_cancellation/i.test(detail)) {
          setConfirming(false);
          queueMicrotask(() => triggerRef.current?.focus());
          if (!/reservation_payment_requires_business_cancellation/i.test(detail)) router.refresh();
        }
      }
    });
  }

  function closeConfirmation() {
    setConfirming(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }

  return (
    <div className="account-withdrawal">
      <button
        ref={triggerRef}
        className="button account-withdrawal__trigger"
        type="button"
        aria-expanded={confirming}
        aria-controls={confirmationId}
        onClick={() => { setFeedback(null); setConfirming((value) => !value); }}
        disabled={isPending}
      >
        {confirming ? "Ocultar retiro" : "Retirar solicitud"}
      </button>
      {confirming ? (
        <div className="account-withdrawal__confirm" id={confirmationId} role="group" aria-label={`Retirar solicitud de ${businessName}`}>
          <p><strong>¿Retirar esta solicitud pendiente?</strong><span>El horario se liberará. Si el negocio ya la confirmó o existe un pago abierto, la operación será rechazada de forma segura.</span></p>
          <div>
            <button className="button account-withdrawal__danger" type="button" onClick={withdraw} disabled={isPending}>{isPending ? "Retirando…" : "Sí, retirar solicitud"}</button>
            <button className="button button--secondary" type="button" onClick={closeConfirmation} disabled={isPending}>Volver</button>
          </div>
        </div>
      ) : null}
      {feedback ? feedback.tone === "error" ? (
        <p className="account-withdrawal__feedback account-withdrawal__feedback--error" role="alert">{feedback.text}</p>
      ) : (
        <p className="account-withdrawal__feedback account-withdrawal__feedback--success" role="status" aria-live="polite">{feedback.text}</p>
      ) : null}
    </div>
  );
}
