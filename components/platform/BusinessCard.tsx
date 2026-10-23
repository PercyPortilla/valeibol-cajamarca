import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/booking";
import { complexRoute } from "@/lib/platform/routes";
import type { PlatformBusinessCard } from "@/lib/data/repositories/platformRepository";

export function BusinessCard({ business }: { business: PlatformBusinessCard }) {
  return (
    <article className="platform-business-card">
      <div className="platform-business-card__top">
        <Badge tone="info">{business.sports.join(" · ") || "Deportes"}</Badge>
        <span>{business.city ?? "Ciudad por confirmar"}{business.country ? `, ${business.country}` : ""}</span>
      </div>
      <div>
        <h2>{business.name}</h2>
        <p>{business.venues} {business.venues === 1 ? "sede" : "sedes"} · {business.courts} {business.courts === 1 ? "cancha" : "canchas"}</p>
      </div>
      <div className="platform-business-card__bottom">
        <span>{business.priceFrom === null ? "Precio por consultar" : `Desde ${formatMoney(business.priceFrom, business.currency)}/h`}</span>
        <Link className="button button--primary" href={complexRoute(business.slug)}>Ver complejo</Link>
      </div>
    </article>
  );
}
