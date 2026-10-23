"use client";

import Link from "next/link";
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
  const [message, setMessage] = useState<string | null>(null);
  const firstVisible = totalBusinesses === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastVisible = Math.min(currentPage * pageSize, totalBusinesses);

  async function setActive(business: PlatformAdminBusiness, active: boolean) {
    if (busyId) return;
    if (!active && !window.confirm(`¿Desactivar ${business.name}? Dejará de ofrecerse públicamente hasta que vuelvas a activarlo.`)) return;
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
        <span>{totalBusinesses === 0 ? "0 registrados" : `Mostrando ${firstVisible}–${lastVisible} de ${totalBusinesses}`}</span>
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
              disabled={Boolean(busyId)}
              onClick={() => setActive(business, !business.isActive)}
            >
              {busyId === business.businessId ? "Actualizando…" : business.isActive ? "Desactivar" : "Activar"}
            </button>
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
