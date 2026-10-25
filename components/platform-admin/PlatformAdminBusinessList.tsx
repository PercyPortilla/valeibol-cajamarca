"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export type PlatformAdminBusiness = {
  businessId: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  isActive: boolean;
  configurationStatus: "provisional" | "confirmed";
  currency: string;
  timezone: string;
  venueCount: number;
  courtCount: number;
  reservationCount: number;
};

type Props = {
  businesses: PlatformAdminBusiness[];
  totalBusinesses: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
};

export function PlatformAdminBusinessList({ businesses, totalBusinesses, currentPage, totalPages, pageSize }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const firstVisible = totalBusinesses === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisible = Math.min(currentPage * pageSize, totalBusinesses);

  async function setActive(business: PlatformAdminBusiness, active: boolean) {
    if (busyId) return;
    if (!active && !window.confirm(`¿Desactivar ${business.name}? Dejará de ofrecerse públicamente hasta que vuelvas a activarlo.`)) return;
    setBusyId(business.businessId);
    setFeedback(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("platform_admin_set_business_active", {
        p_business_id: business.businessId,
        p_active: active,
      });
      if (error) {
        setFeedback({
          kind: "error",
          message: error.message.toLowerCase().includes("business_has_future_reservations")
            ? "No puedes desactivar este negocio mientras tenga reservas futuras pendientes o confirmadas."
            : "No pudimos actualizar el estado del negocio.",
        });
        return;
      }
      setFeedback({ kind: "success", message: `${business.name} quedó ${active ? "activo" : "inactivo"}.` });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "No pudimos conectar con la administración global." });
    } finally {
      setBusyId(null);
    }
  }

  async function updateCore(event: FormEvent<HTMLFormElement>, business: PlatformAdminBusiness) {
    event.preventDefault();
    if (busyId || business.configurationStatus !== "provisional") return;
    const form = new FormData(event.currentTarget);
    const slug = String(form.get("slug") ?? "").trim();
    const currency = String(form.get("currency") ?? "").trim().toUpperCase();
    const timezone = String(form.get("timezone") ?? "").trim();
    if (!window.confirm(`¿Guardar la configuración estructural de ${business.name}? No se convierten importes ni horarios existentes automáticamente.`)) return;
    setBusyId(business.businessId);
    setFeedback(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("platform_admin_update_business_core", {
        p_business_id: business.businessId,
        p_slug: slug,
        p_currency: currency,
        p_timezone: timezone,
      });
      if (error) {
        const normalized = error.message.toLowerCase();
        const message = normalized.includes("business_must_be_unpublished")
          ? "El negocio debe estar retirado de publicación antes de cambiar esta configuración."
          : normalized.includes("currency_change_blocked_by_reservation_history")
            ? "No se puede cambiar la moneda porque ya existe historial de reservas con importes."
            : normalized.includes("timezone_change_blocked_by_schedule_history")
              ? "No se puede cambiar la zona horaria porque ya existe historial de reservas o bloqueos."
              : normalized.includes("business_slug_taken") || normalized.includes("duplicate") || normalized.includes("unique")
                ? "Ese slug ya está en uso por otro negocio."
                : normalized.includes("invalid_timezone")
                  ? "La zona horaria no es una zona IANA válida."
                  : normalized.includes("invalid_currency") || normalized.includes("invalid_business_slug")
                    ? "Revisa slug y moneda antes de guardar."
                    : "No pudimos actualizar la configuración estructural del negocio.";
        setFeedback({ kind: "error", message });
        return;
      }
      setFeedback({ kind: "success", message: `Configuración estructural de ${business.name} actualizada.` });
      setEditingId(null);
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "No pudimos conectar con la administración global." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="global-admin-board">
      <div className="global-admin-board__heading">
        <div><span className="eyebrow">NEGOCIOS</span><h2>Tenants de la plataforma</h2></div>
        <span>{totalBusinesses === 0 ? "0 registrados" : `Mostrando ${firstVisible}–${lastVisible} de ${totalBusinesses}`}</span>
      </div>
      {feedback ? <div className={feedback.kind === "error" ? "auth-error" : "global-admin-notice"} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</div> : null}
      <div className="global-admin-business-list">
        {businesses.map((business) => (
          <article key={business.businessId} className="global-admin-business-row">
            <div className="global-admin-business-row__main">
              <span className={business.isActive ? "global-admin-state global-admin-state--active" : "global-admin-state"}>{business.isActive ? "Activo" : "Inactivo"}</span>
              <div><strong>{business.name}</strong><small>{business.slug} · {business.city ?? "Sin ciudad"}{business.country ? `, ${business.country}` : ""}</small><small>{business.currency} · {business.timezone} · {business.configurationStatus === "confirmed" ? "Publicado" : "En preparación"}</small></div>
            </div>
            <dl>
              <div><dt>Sedes</dt><dd>{business.venueCount}</dd></div>
              <div><dt>Canchas</dt><dd>{business.courtCount}</dd></div>
              <div><dt>Reservas</dt><dd>{business.reservationCount}</dd></div>
            </dl>
            <div className="global-admin-business-row__actions">
              <button type="button" className="button button--secondary" disabled={Boolean(busyId) || business.configurationStatus !== "provisional"} onClick={() => setEditingId((current) => current === business.businessId ? null : business.businessId)}>
                {editingId === business.businessId ? "Cerrar edición" : "Editar configuración"}
              </button>
              <button
                type="button"
                className={business.isActive ? "button button--secondary" : "button button--primary"}
                disabled={Boolean(busyId)}
                onClick={() => setActive(business, !business.isActive)}
              >
                {busyId === business.businessId ? "Actualizando…" : business.isActive ? "Desactivar" : "Activar"}
              </button>
            </div>
            {business.configurationStatus !== "provisional" ? <p className="global-admin-business-row__hint">El propietario debe retirar la publicación antes de corregir slug, moneda o zona horaria.</p> : null}
            {editingId === business.businessId ? (
              <form className="global-admin-business-core-form" onSubmit={(event) => void updateCore(event, business)}>
                <label>Slug público<input name="slug" defaultValue={business.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
                <label>Moneda<input name="currency" defaultValue={business.currency} required maxLength={3} /></label>
                <label>Zona horaria IANA<input name="timezone" defaultValue={business.timezone} required /></label>
                <p>La moneda no convierte importes. La zona horaria no puede cambiar si ya existe historial temporal.</p>
                <button className="button button--primary" type="submit" disabled={busyId === business.businessId}>{busyId === business.businessId ? "Guardando…" : "Guardar configuración"}</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>
      {totalPages > 1 ? (
        <nav className="global-admin-pagination" aria-label="Paginación de negocios">
          <div>{currentPage > 1 ? <Link className="button button--secondary" href={`/admin-global?page=${currentPage - 1}`}>← Anterior</Link> : null}</div>
          <span className="global-admin-pagination__status">Página {currentPage} de {totalPages}</span>
          <div>{currentPage < totalPages ? <Link className="button button--secondary" href={`/admin-global?page=${currentPage + 1}`}>Siguiente →</Link> : null}</div>
        </nav>
      ) : null}
    </section>
  );
}
