"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { normalizePeruWhatsApp } from "@/lib/booking";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

type Props = {
  email: string;
  initialDisplayName: string;
  initialPhoneE164: string;
};

export function CustomerProfileForm({ email, initialDisplayName, initialPhoneE164 }: Props) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [phone, setPhone] = useState(initialPhoneE164);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalizedName = displayName.trim().replace(/\s+/g, " ");
    const normalizedPhone = normalizePeruWhatsApp(phone);
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setSuccess(false);
      setMessage("Ingresa un nombre válido de 2 a 120 caracteres.");
      return;
    }
    if (!normalizedPhone) {
      setSuccess(false);
      setMessage("Ingresa un WhatsApp peruano válido.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      const { data, error } = await createPublicBrowserSupabaseClient().rpc("update_my_customer_profile", {
        p_display_name: normalizedName,
        p_phone_e164: normalizedPhone,
      });
      const row = data?.[0];
      if (error || !row) {
        const detail = error?.message.toLowerCase() ?? "";
        setMessage(detail.includes("customer_account_inactive")
          ? "Tu cuenta no está habilitada para editar el perfil."
          : "No pudimos guardar tus datos. Revisa la información e inténtalo nuevamente.");
        return;
      }
      setDisplayName(row.display_name ?? normalizedName);
      setPhone(row.phone_e164 ?? normalizedPhone);
      setSuccess(true);
      setMessage("Tus datos se guardaron correctamente.");
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con tu cuenta. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="customer-auth-card" aria-labelledby="customer-profile-title">
      <div className="account-section-heading"><div><span className="eyebrow">MIS DATOS</span><h2 id="customer-profile-title">Datos de contacto</h2><p>Estos datos se usarán como sugerencia al iniciar una nueva reserva.</p></div></div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <Input label="Nombre" name="customer-display-name" autoComplete="name" maxLength={120} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <Input label="WhatsApp" name="customer-phone" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} hint="Se guarda en formato internacional (+51…)." />
        <Input label="Email de acceso" name="customer-email" type="email" value={email} readOnly disabled hint="El email no se modifica en este bloque." />
        {message ? <div className={success ? "auth-notice auth-notice--success" : "auth-error"} role={success ? "status" : "alert"}>{message}</div> : null}
        <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</Button>
      </form>
    </section>
  );
}

