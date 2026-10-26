"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import { platformConfig } from "@/config/platform";

type OnboardingResponse = {
  ok?: boolean;
  ownerInvited?: boolean;
  business?: {
    business_id: string;
    business_slug: string;
    business_name: string;
  };
  code?: string;
};

function onboardingError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("owner_account_not_found")) return "No pudimos preparar la cuenta del propietario. Inténtalo nuevamente.";
  if (normalized.includes("owner_already_assigned")) return "Esa cuenta ya administra otro negocio. El modelo actual mantiene un negocio por cuenta propietaria.";
  if (normalized.includes("platform_admin_cannot_be_tenant_owner")) return "Una cuenta ADMIN global no puede convertirse en propietaria de un tenant.";
  if (normalized.includes("business_slug_taken") || normalized.includes("duplicate") || normalized.includes("unique")) return "El slug ya está en uso. Elige otro identificador.";
  if (normalized.includes("rate_limited")) return "Se alcanzó temporalmente el límite de invitaciones. Inténtalo nuevamente más tarde.";
  if (normalized.includes("invite_failed")) return "No pudimos enviar la invitación al propietario. El negocio no fue creado.";
  if (normalized.includes("platform_admin_access_denied") || normalized.includes("authentication_required")) return "Tu sesión ya no tiene permisos de ADMIN global. Vuelve a iniciar sesión.";
  if (normalized.includes("invalid_payload") || normalized.includes("invalid_")) return "Revisa los datos ingresados antes de crear el negocio.";
  return "No pudimos crear el negocio. Inténtalo nuevamente.";
}

async function invokeOnboarding(body: Record<string, unknown>) {
  const supabase = createPublicBrowserSupabaseClient();
  const { data, error } = await supabase.functions.invoke<OnboardingResponse>("platform-business-onboarding", { body });

  if (error) {
    let code = error.message;
    const context = (error as { context?: unknown }).context;
    if (typeof Response !== "undefined" && context instanceof Response) {
      try {
        const payload = await context.clone().json() as { code?: string };
        code = payload.code || code;
      } catch {
        // Conserva el mensaje de FunctionsHttpError si el body no es JSON.
      }
    }
    throw new Error(code);
  }
  const business = data?.business;
  if (!data?.ok || !business) throw new Error(data?.code || "onboarding_failed");
  return { ...data, ok: true as const, business };
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
    if (!formElement.checkValidity()) {
      formElement.reportValidity();
      return;
    }
    const form = new FormData(formElement);
    setBusy(true);
    setMessage(null);
    setSuccess(false);
    try {
      const result = await invokeOnboarding({
        slug: String(form.get("slug") ?? ""),
        name: String(form.get("name") ?? ""),
        ownerEmail: String(form.get("ownerEmail") ?? ""),
        city: String(form.get("city") ?? "") || null,
        country: String(form.get("country") ?? "") || null,
        address: String(form.get("address") ?? "") || null,
        phone: String(form.get("phone") ?? "") || null,
        currency: String(form.get("currency") ?? "PEN"),
        timezone: String(form.get("timezone") ?? "America/Lima"),
      });
      setSuccess(true);
      setMessage(result.ownerInvited
        ? `${result.business.business_name} fue creado. Enviamos al propietario una invitación para crear su contraseña y activar el acceso.`
        : `${result.business.business_name} fue creado y vinculado a la cuenta existente del propietario.`);
      formElement.reset();
      router.refresh();
    } catch (error) {
      setMessage(onboardingError(error instanceof Error ? error.message : "onboarding_failed"));
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
      <p className="global-admin-footnote">Si el propietario ya tiene cuenta, se vincula como OWNER. Si todavía no existe, la plataforma crea una invitación segura para que defina su contraseña. El ADMIN global no obtiene acceso operativo al tenant.</p>
      <form className="global-admin-onboarding__form" onSubmit={submit} noValidate>
        <Input label="Nombre del negocio" name="name" required maxLength={120} />
        <Input label="Slug público" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="complejo-deportivo" />
        <Input label="Correo del propietario" name="ownerEmail" type="email" required autoComplete="off" />
        <Input label="Ciudad" name="city" maxLength={120} defaultValue={platformConfig.city} required />
        <Input label="País" name="country" maxLength={120} defaultValue={platformConfig.country} required />
        <Input label="Dirección" name="address" maxLength={240} />
        <Input label="Teléfono público (E.164)" name="phone" type="tel" placeholder="+51999999999" />
        <Input label="Moneda" name="currency" defaultValue="PEN" maxLength={3} required />
        <Input label="Zona horaria IANA" name="timezone" defaultValue="America/Lima" required />
        <Button type="submit" disabled={busy}>{busy ? "Creando…" : "Crear negocio y preparar acceso"}</Button>
      </form>
      {message ? <div className={success ? "global-admin-notice" : "auth-error"} role={success ? "status" : "alert"}>{message}</div> : null}
    </section>
  );
}
