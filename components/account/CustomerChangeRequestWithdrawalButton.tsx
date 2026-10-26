"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export function CustomerChangeRequestWithdrawalButton({
  requestId,
  label,
}: {
  requestId: string;
  label: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function withdraw() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("withdraw_my_reservation_change_request", {
        p_request_id: requestId,
      });
      if (error) {
        const normalized = error.message.toLowerCase();
        setMessage(
          normalized.includes("customer_change_request_expired_requires_expiration")
            ? "La solicitud ya venció y no puede retirarse como desistimiento. Actualiza la página."
            : normalized.includes("customer_change_request_already_resolved")
            ? "La solicitud ya fue resuelta o cerrada. Actualiza la página."
            : normalized.includes("customer_change_request_not_found")
              ? "La solicitud ya no está disponible en tu cuenta."
              : "No pudimos retirar la solicitud. Actualiza la página e inténtalo nuevamente.",
        );
        return;
      }
      setConfirming(false);
      setMessage("Solicitud retirada. Tu reserva original no fue modificada.");
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con el servicio de reservas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-withdrawal">
      {!confirming ? (
        <button className="button button--ghost" type="button" disabled={busy} onClick={() => setConfirming(true)}>
          Retirar solicitud
        </button>
      ) : (
        <div className="account-withdrawal__confirm" role="group" aria-label={"Retirar " + label}>
          <p>Retirarás esta solicitud. La reserva original permanecerá sin cambios.</p>
          <div>
            <button className="button account-withdrawal__danger" type="button" disabled={busy} onClick={() => void withdraw()}>
              {busy ? "Retirando…" : "Sí, retirar solicitud"}
            </button>
            <button className="button button--ghost" type="button" disabled={busy} onClick={() => setConfirming(false)}>
              Volver
            </button>
          </div>
        </div>
      )}
      {message ? <p className="account-withdrawal__feedback" role="status">{message}</p> : null}
    </div>
  );
}
