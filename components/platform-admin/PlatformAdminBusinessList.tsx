"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export type PlatformAdminBusiness = {
  businessId: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  isActive: boolean;
  ownerUserId: string | null;
  venueCount: number;
  courtCount: number;
  reservationCount: number;
};

export function PlatformAdminBusinessList({ businesses }: { businesses: PlatformAdminBusiness[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function setActive(business: PlatformAdminBusiness, active: boolean) {
    if (busyId) return;
    setBusyId(business.businessId);
    setMessage(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("platform_admin_set_business_active", {
        p_business_id: business.businessId,
        p_active: active,
      });
      if (error) {
        setMessage("No pudimos actualizar el estado del negocio.");
        return;
      }
      setMessage(`${business.name} quedó ${active ? "activo" : "inactivo"}.`);
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con la administración global.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="global-admin-board">
      <div className="global-admin-board__heading">
        <div><span className="eyebrow">NEGOCIOS</span><h2>Tenants de la plataforma</h2></div>
        <span>{businesses.length} registrados</span>
      </div>
      {message ? <div className="global-admin-notice" role="status">{message}</div> : null}
      <div className="global-admin-business-list">
        {businesses.map((business) => (
          <article key={business.businessId} className="global-admin-business-row">
            <div className="global-admin-business-row__main">
              <span className={business.isActive ? "global-admin-state global-admin-state--active" : "global-admin-state"}>{business.isActive ? "Activo" : "Inactivo"}</span>
              <div><strong>{business.name}</strong><small>{business.slug} · {business.city ?? "Sin ciudad"}{business.country ? `, ${business.country}` : ""}</small></div>
            </div>
            <dl>
              <div><dt>Sedes</dt><dd>{business.venueCount}</dd></div>
              <div><dt>Canchas</dt><dd>{business.courtCount}</dd></div>
              <div><dt>Reservas</dt><dd>{business.reservationCount}</dd></div>
            </dl>
            <button
              type="button"
              className={business.isActive ? "button button--secondary" : "button button--primary"}
              disabled={busyId === business.businessId}
              onClick={() => setActive(business, !business.isActive)}
            >
              {busyId === business.businessId ? "Actualizando…" : business.isActive ? "Desactivar" : "Activar"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
