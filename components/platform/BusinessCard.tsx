import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/booking";
import { complexRoute } from "@/lib/platform/routes";
import type { PlatformBusinessCard } from "@/lib/data/repositories/platformRepository";
import { Icon } from "@/components/ui/Icon";
import { FavoriteButton } from "@/components/platform/FavoriteButton";

export function BusinessCard({ business }: { business: PlatformBusinessCard }) {
  return (
    <article className="platform-business-card">
      <FavoriteButton businessId={business.businessId} businessName={business.name} />
      <div
        className={business.coverImageUrl ? "platform-business-card__visual platform-business-card__visual--image" : "platform-business-card__visual"}
        aria-hidden={business.coverImageUrl ? undefined : true}
      >
        {business.coverImageUrl ? (
          <Image
            className="platform-business-card__cover"
            src={business.coverImageUrl}
            alt={business.coverAltText ?? `Instalaciones de ${business.name}`}
            fill
            sizes="(max-width: 680px) calc(100vw - 24px), (max-width: 1000px) 50vw, 380px"
          />
        ) : null}
        <span className={business.logoUrl ? "platform-business-card__logo-mark platform-business-card__logo-mark--image" : "platform-business-card__logo-mark"}>
          {business.logoUrl ? (
            <Image
              className="platform-business-card__logo"
              src={business.logoUrl}
              alt={`Logo de ${business.name}`}
              fill
              sizes="48px"
            />
          ) : business.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="platform-business-card__court-lines"><i /><b /></div>
      </div>
      <div className="platform-business-card__body">
        <div className="platform-business-card__top">
          <div className="platform-business-card__sports">
            {(business.sports.length ? business.sports : ["Deportes"]).slice(0, 3).map((sport) => <Badge key={sport} tone="info">{sport}</Badge>)}
            {business.sports.length > 3 ? <Badge tone="neutral">+{business.sports.length - 3}</Badge> : null}
          </div>
          <span><Icon name="location" size={14} /> {business.city ?? "Ciudad por confirmar"}{business.country ? `, ${business.country}` : ""}</span>
        </div>
        <div className="platform-business-card__copy">
          <h2>{business.name}</h2>
          <p>{business.venues} {business.venues === 1 ? "sede" : "sedes"} · {business.courts} {business.courts === 1 ? "cancha" : "canchas"}</p>
        </div>
        <div className="platform-business-card__meta">
          <span><Icon name="clock" size={15} /> Reserva por hora</span>
          <span>{business.priceFrom === null ? "Precio por consultar" : `Desde ${formatMoney(business.priceFrom, business.currency)}/h`}</span>
        </div>
        <div className="platform-business-card__reputation">
          {business.reviewCount > 0 && business.ratingAverage !== null ? (
            <span aria-label={`${business.ratingAverage.toFixed(1)} de 5, ${business.reviewCount} reseñas verificadas`}><b aria-hidden="true">★</b> {business.ratingAverage.toFixed(1)} · {business.reviewCount} {business.reviewCount === 1 ? "reseña" : "reseñas"}</span>
          ) : <span>Aún sin reseñas verificadas</span>}
        </div>
        <div className="platform-business-card__bottom">
          <span>Explora sedes y disponibilidad</span>
          <Link className="button button--primary" href={complexRoute(business.slug)}>Ver complejo <b aria-hidden="true">→</b></Link>
        </div>
      </div>
    </article>
  );
}
