"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import { CustomerChangeRequestWithdrawalButton } from "@/components/account/CustomerChangeRequestWithdrawalButton";

type RequestStatus = "pending" | "approved" | "rejected";

export function CustomerReservationCancellationRequest({
  reservationId,
  requestId,
  requestStatus,
  resolutionKind,
  resolutionNote,
  canWithdrawPending,
  canRequest,
}: {
  reservationId: string;
  requestId: string | null;
  requestStatus: RequestStatus | null;
  resolutionKind: string | null;
  resolutionNote: string | null;
  canWithdrawPending: boolean;
  canRequest: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const businessResponse = resolutionKind === "admin_resolution" && resolutionNote ? ` Respuesta del negocio: ${resolutionNote}` : "";

  if (requestStatus === "pending") return <div className="account-withdrawal"><small className="account-contact-unavailable">{canWithdrawPending ? "Cancelación solicitada · pendiente de revisión." : "La solicitud de cancelación ya venció y está pendiente de cierre por el negocio."}</small>{requestId && canWithdrawPending ? <CustomerChangeRequestWithdrawalButton requestId={requestId} label="solicitud de cancelación" /> : null}</div>;
  if (requestStatus === "rejected" && resolutionKind === "customer_expiration") return <small className="account-contact-unavailable">La solicitud de cancelación expiró sin modificar tu reserva.</small>;
  if (!canRequest && requestStatus === "rejected" && resolutionKind === "customer_withdrawal") return <small className="account-contact-unavailable">Retiraste tu solicitud de cancelación. La reserva original no fue modificada.</small>;
  if (!canRequest && requestStatus === "approved") return <small className="account-contact-unavailable">Solicitud de cancelación aprobada.{businessResponse}</small>;
  if (!canRequest && requestStatus === "rejected") return <small className="account-contact-unavailable">Solicitud de cancelación rechazada. Ya no está disponible una nueva solicitud para esta reserva.{businessResponse}</small>;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("request_my_reservation_cancellation", {
        p_reservation_id: reservationId,
        p_reason: reason.trim() || null,
      });
      if (error) {
        setMessage("No pudimos registrar la solicitud de cancelación.");
        return;
      }
      setMessage("Cancelación solicitada. La reserva sigue confirmada hasta que el negocio la apruebe.");
      setOpen(false);
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con el servicio de reservas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-withdrawal">
      {requestStatus === "rejected" && canRequest ? <small className="account-contact-unavailable">{resolutionKind === "customer_expiration" ? "La solicitud anterior expiró. Puedes enviar una nueva mientras la reserva siga confirmada y futura." : resolutionKind === "customer_withdrawal" ? "Retiraste la solicitud anterior. Puedes enviar una nueva mientras la reserva siga confirmada y futura." : `La solicitud anterior fue rechazada. Puedes enviar una nueva mientras la reserva siga confirmada y futura.${businessResponse}`}</small> : null}
      {!open ? <button className="button button--ghost button--danger-soft" type="button" onClick={() => setOpen(true)}>Solicitar cancelación</button> : (
        <div className="account-withdrawal__confirm" role="group" aria-label="Solicitar cancelación">
          <label className="field"><span className="field__label">Motivo (opcional)</span><textarea className="field__control" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <p>La reserva seguirá confirmada hasta que el negocio apruebe la solicitud.</p>
          <div><button className="button account-withdrawal__danger" type="button" disabled={busy} onClick={() => void submit()}>{busy ? "Enviando…" : "Enviar solicitud"}</button><button className="button button--ghost" type="button" disabled={busy} onClick={() => setOpen(false)}>Volver</button></div>
        </div>
      )}
      {message ? <p className="account-withdrawal__feedback" role="status">{message}</p> : null}
    </div>
  );
}

