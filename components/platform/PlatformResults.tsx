import Link from "next/link";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { BusinessCard } from "./BusinessCard";
import type { PlatformBusinessCard } from "@/lib/data/repositories/platformRepository";

type Props = {
  businesses: PlatformBusinessCard[];
  premium?: boolean;
  lightingRequired?: boolean;
  loadFailed?: boolean;
  filtered?: boolean;
  retryHref?: string;
};

export function PlatformResults({ businesses, premium = false, lightingRequired = false, loadFailed = false, filtered = false, retryHref = "/buscar" }: Props) {
  if (loadFailed) {
    return <div className="platform-results-feedback"><ErrorState title="No pudimos cargar los complejos" /><Link className="button button--secondary" href={retryHref}>Volver a intentar</Link></div>;
  }
  if (businesses.length === 0) {
    return <div className="platform-results-feedback">
      <EmptyState
        title={filtered ? "No hay complejos para este deporte" : "Todavía no hay complejos publicados"}
        detail={filtered ? "Prueba con otro deporte para explorar las canchas de Cajamarca." : "Los nuevos complejos aparecerán aquí cuando publiquen sus instalaciones."}
      />
      {filtered ? <Link className="button button--secondary" href="/buscar">Ver todos los deportes</Link> : null}
    </div>;
  }

  return <div className={`platform-results-grid${premium ? " platform-results-grid--premium" : ""}${premium && businesses.length === 1 ? " platform-results-grid--spotlight" : ""}`}>{businesses.map((business) => <BusinessCard key={business.businessId} business={business} premium={premium} lightingRequired={lightingRequired} />)}</div>;
}
