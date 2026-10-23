"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import type { PaymentMethod } from "@/lib/data/supabase/database.types";
import type { PublicPaymentMethod } from "@/lib/payments";

export function PaymentReportForm({
  reservationId,
  methods,
}: {
  reservationId: string;
  methods: PublicPaymentMethod[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>(methods[0]?.method ?? "yape");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (methods.length === 0) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createPublicBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("report_my_payment", {
        p_reservation_id: reservationId,
        p_method: method,
        p_reference: reference.trim() || null,
      });
      if (rpcError) {
        setError(rpcError.message.includes("payment_already_reported")
          ? "Ya existe un pago reportado o verificado para esta reserva."
          : "No pudimos registrar el reporte. Verifica el método e inténtalo nuevamente.");
        return;
      }
      router.refresh();
    } catch {
      setError("No pudimos conectar con el servicio de pagos manuales.");
    } finally {
      setBusy(false);
    }
  }

  const selected = methods.find((item) => item.method === method);
  return (
    <form className="payment-report-form" onSubmit={submit}>
      <strong>Reportar pago manual</strong>
      <p>Este reporte queda pendiente de verificación del negocio.</p>
      <label><span>Método</span><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>{methods.map((item) => <option key={item.method} value={item.method}>{item.label}</option>)}</select></label>
      {selected?.destination ? <div className="payment-destination"><small>Destino</small><b>{selected.destination}</b>{selected.instructions ? <span>{selected.instructions}</span> : null}</div> : null}
      <label><span>Referencia / código (opcional)</span><input maxLength={160} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. operación 123456" /></label>
      {error ? <div className="auth-error" role="alert">{error}</div> : null}
      <button className="button button--secondary" type="submit" disabled={busy}>{busy ? "Registrando…" : "Reportar pago"}</button>
    </form>
  );
}
