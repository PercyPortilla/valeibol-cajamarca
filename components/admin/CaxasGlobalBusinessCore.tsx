"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdminBusinessStructure } from "@/lib/admin/inventory";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export function CaxasGlobalBusinessCore({ structure }: { structure: AdminBusinessStructure }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const editable = structure.configurationStatus === "provisional";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editable || busy) return;
    const form = new FormData(event.currentTarget);
    const slug = String(form.get("slug") ?? "").trim();
    const currency = String(form.get("currency") ?? "").trim().toUpperCase();
    const timezone = String(form.get("timezone") ?? "").trim();
    if (!window.confirm("¿Actualizar los datos estructurales? Las tarifas y horarios históricos no se convertirán automáticamente.")) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("platform_admin_update_business_core", {
        p_business_id: structure.businessId, p_slug: slug, p_currency: currency, p_timezone: timezone,
      });
      if (error) {
        const message = error.message.toLowerCase();
        setFeedback(message.includes("business_must_be_unpublished") ? "Retira primero el negocio de publicación."
          : message.includes("currency_change_blocked_by_reservation_history") ? "La moneda no puede cambiarse con reservas históricas."
          : message.includes("timezone_change_blocked_by_schedule_history") ? "Hay horarios o reservas históricas que impiden cambiar la zona horaria."
          : message.includes("business_slug_taken") || message.includes("unique") ? "La dirección pública ya pertenece a otro negocio."
          : message.includes("invalid_") ? "Revisa el identificador, la moneda y la zona horaria."
          : "No fue posible actualizar los datos estructurales.");
        return;
      }
      setFeedback("Configuración global guardada.");
      router.refresh();
    } catch {
      setFeedback("No se pudo conectar con la administración global.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="caxas-workspace__core">
    <div><span className="caxas-workspace__eyebrow">EXCLUSIVO DE ADMINISTRACIÓN GLOBAL</span><h3>Dirección pública, moneda y zona horaria</h3>
      <p>Estos valores son estructurales. Solo pueden modificarse antes de la publicación y cuando el historial lo permite.</p></div>
    <form onSubmit={(event) => void save(event)} className="caxas-workspace__core-form">
      <label>Identificador público<input name="slug" defaultValue={structure.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" disabled={!editable || busy}/></label>
      <label>Moneda ISO<input name="currency" defaultValue={structure.currency} required minLength={3} maxLength={3} disabled={!editable || busy}/></label>
      <label>Zona horaria IANA<input name="timezone" defaultValue={structure.timezone} required disabled={!editable || busy}/></label>
      <button type="submit" className="button button--secondary" disabled={!editable || busy}>{busy ? "Guardando…" : "Guardar estructura global"}</button>
    </form>
    {!editable ? <p className="caxas-workspace__fineprint">El negocio está publicado. Para cambiar estos datos, primero retíralo de publicación y revisa las restricciones por historial.</p> : null}
    {feedback ? <p role="status">{feedback}</p> : null}
  </section>;
}
