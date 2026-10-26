"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function CustomerReservationClaimForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalized = code.trim().toLowerCase();
    if (!UUID_RE.test(normalized)) {
      setSuccess(false);
      setMessage("Ingresa el código de recuperación completo de tu reserva.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      const { data, error } = await createPublicBrowserSupabaseClient().rpc("claim_public_reservation", {
        p_request_token: normalized,
      });
      if (error || typeof data !== "string") {
        setMessage(error?.message.toLowerCase().includes("customer_account_inactive")
          ? "Tu cuenta no está habilitada para recuperar reservas."
          : "No pudimos vincular esa reserva. Revisa el código o confirma que no pertenezca a otra cuenta.");
        return;
      }
      setCode("");
      setSuccess(true);
      setMessage("Reserva vinculada correctamente. Ya aparece en tu historial de Mi cuenta.");
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con el servicio de reservas. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="customer-auth-card" aria-labelledby="claim-reservation-title">
      <div className="account-section-heading"><div><span className="eyebrow">RECUPERAR RESERVA</span><h2 id="claim-reservation-title">Vincular una reserva anterior</h2><p>Si reservaste sin iniciar sesión o la vinculación automática falló, ingresa el código secreto que recibiste al finalizar.</p></div></div>
      <form className="auth-form" onSubmit={claim} noValidate>
        <Input label="Código de recuperación" name="reservation-recovery-code" autoComplete="off" spellCheck={false} required value={code} onChange={(event) => setCode(event.target.value)} placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" hint="El ID público de la solicitud no sirve para reclamarla; usa únicamente el código secreto de recuperación." />
        {message ? <div className={success ? "auth-notice auth-notice--success" : "auth-error"} role={success ? "status" : "alert"}>{message}</div> : null}
        <Button type="submit" disabled={busy}>{busy ? "Vinculando…" : "Vincular reserva a Mi cuenta"}</Button>
      </form>
    </section>
  );
}
