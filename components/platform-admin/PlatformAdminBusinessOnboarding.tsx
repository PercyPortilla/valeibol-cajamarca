"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

function onboardingError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("owner_account_not_found")) return "El correo del propietario aún no tiene una cuenta. Debe crearla primero en Mi cuenta.";
  if (normalized.includes("owner_already_assigned")) return "Esa cuenta ya administra otro negocio. B20 mantiene un negocio por cuenta propietaria.";
  if (normalized.includes("platform_admin_cannot_be_tenant_owner")) return "Una cuenta ADMIN global no puede convertirse en propietaria de un tenant.";
  if (normalized.includes("duplicate") || normalized.includes("unique")) return "El slug ya está en uso. Elige otro identificador.";
  if (normalized.includes("invalid_")) return "Revisa los datos ingresados antes de crear el negocio.";
  return "No pudimos crear el negocio. Inténtalo nuevamente.";
}

export function PlatformAdminBusinessOnboarding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      const { data, error } = await createPublicBrowserSupabaseClient().rpc("platform_admin_create_business", {
        p_slug: String(form.get("slug") ?? ""),
        p_name: String(form.get("name") ?? ""),
        p_owner_email: String(form.get("ownerEmail") ?? ""),
        p_city: String(form.get("city") ?? "") || null,
        p_country: String(form.get("country") ?? "") || null,
        p_address: String(form.get("address") ?? "") || null,
        p_phone: String(form.get("phone") ?? "") || null,
        p_currency: String(form.get("currency") ?? "PEN"),
        p_timezone: String(form.get("timezone") ?? "America/Lima"),
      });
      if (error) {
        setMessage(onboardingError(error.message));
        return;
      }
      const created = data?.[0];
      setSuccess(true);
      setMessage(created ? `${created.business_name} fue creado y vinculado a su propietario.` : "Negocio creado correctamente.");
      formElement.reset();
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con la administración global.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="global-admin-board global-admin-onboarding" aria-labelledby="new-business-title">
      <div className="global-admin-board__heading">
        <div><span className="eyebrow">ALTA DE TENANT</span><h2 id="new-business-title">Nuevo negocio</h2></div>
        <span>Sin SQL manual</span>
      </div>
      <p className="global-admin-footnote">El propietario debe tener primero una cuenta de cliente. El alta vincula esa cuenta como OWNER sin dar al ADMIN global acceso operativo al tenant.</p>
      <form className="global-admin-onboarding__form" onSubmit={submit} noValidate>
        <Input label="Nombre del negocio" name="name" required maxLength={120} />
        <Input label="Slug público" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="complejo-deportivo" />
        <Input label="Correo del propietario" name="ownerEmail" type="email" required autoComplete="off" />
        <Input label="Ciudad" name="city" maxLength={120} />
        <Input label="País" name="country" maxLength={120} />
        <Input label="Dirección" name="address" maxLength={240} />
        <Input label="Teléfono público (E.164)" name="phone" type="tel" placeholder="+51999999999" />
        <Input label="Moneda" name="currency" defaultValue="PEN" maxLength={3} required />
        <Input label="Zona horaria IANA" name="timezone" defaultValue="America/Lima" required />
        <Button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear negocio y asignar owner"}</Button>
      </form>
      {message ? <div className={success ? "global-admin-notice" : "auth-error"} role={success ? "status" : "alert"}>{message}</div> : null}
    </section>
  );
}

\n