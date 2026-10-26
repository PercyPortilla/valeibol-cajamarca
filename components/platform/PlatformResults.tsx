import { EmptyState } from "@/components/ui/States";
import { BusinessCard } from "./BusinessCard";
import type { PlatformBusinessCard } from "@/lib/data/repositories/platformRepository";

type Props = {
  businesses: PlatformBusinessCard[];
  premium?: boolean;
  lightingRequired?: boolean;
};

export function PlatformResults({ businesses, premium = false, lightingRequired = false }: Props) {
  if (businesses.length === 0) {
    return <EmptyState title="Todavía no hay canchas para este filtro" detail="Prueba con otro deporte. Por ahora Caxas SportCenter muestra únicamente oferta disponible en Cajamarca." />;
  }

  return <div className="platform-results-grid">{businesses.map((business) => <BusinessCard key={business.businessId} business={business} premium={premium} lightingRequired={lightingRequired} />)}</div>;
}
