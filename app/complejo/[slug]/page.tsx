import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ValeibolLanding } from "@/components/site/ValeibolLanding";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/booking";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { buildBusinessDetail } from "@/lib/data/repositories/platformRepository";
import { googleMapsSearchHref } from "@/lib/platform/maps";
import { businessConfig } from "@/config/business";
import { StructuredData } from "@/components/platform/StructuredData";
import { buildBusinessJsonLd } from "@/lib/platform/seo";
import { absoluteSiteUrl } from "@/lib/platform/siteUrl";
import { FavoriteButton } from "@/components/platform/FavoriteButton";
import { PublicReviewsSection } from "@/components/platform/PublicReviewsSection";
import { getPublicBusinessReviews } from "@/lib/data/reputationService";
import { getPublicSiteContent } from "@/lib/data/publicSiteContentService";
import { themeCssVariables } from "@/lib/siteContent";
import { Icon } from "@/components/ui/Icon";
import type { CSSProperties } from "react";
import { getPublicBusinessContact } from "@/lib/data/publicBusinessContactService";
import { buildWhatsAppChatHref } from "@/lib/whatsapp/links";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getPublicPlatformCatalog({ businessSlug: slug });
  const business = buildBusinessDetail(catalog, slug);
  const canonical = `/complejo/${encodeURIComponent(slug)}`;

  if (!business) return { title: "Complejo deportivo", robots: { index: false, follow: true } };

  const location = business.city ? ` en ${business.city}` : "";
  const description = slug === businessConfig.slug
    ? `Consulta disponibilidad, precios y reserva la cancha de ${business.name}${location}.`
    : `Explora sedes, canchas, deportes y disponibilidad de ${business.name}${location}.`;
  const image = business.coverImageUrl?.startsWith("http")
    ? business.coverImageUrl
    : business.coverImageUrl
      ? absoluteSiteUrl(business.coverImageUrl)
      : null;
  const logo = business.logoUrl?.startsWith("http")
    ? business.logoUrl
    : business.logoUrl
      ? absoluteSiteUrl(business.logoUrl)
      : null;
  const socialImage = image ?? logo;
  const title = slug === businessConfig.slug
    ? `${business.name} | Cancha de vóley${location}`
    : `${business.name} | Complejo deportivo${location}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      ...(socialImage ? { images: [{ url: socialImage, alt: image ? business.coverAltText ?? `Instalaciones de ${business.name}` : `Logo de ${business.name}` }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(socialImage ? { images: [socialImage] } : {}),
    },
  };
}

export default async function ComplexPage({ params }: { params: Params }) {
  const { slug } = await params;
  const catalog = await getPublicPlatformCatalog({ businessSlug: slug });
  const business = buildBusinessDetail(catalog, slug);
  if (!business) notFound();
  if (slug === businessConfig.slug) {
    return (
      <>
        {business ? <StructuredData data={buildBusinessJsonLd(business)} /> : null}
        <ValeibolLanding />
      </>
    );
  }
  const [reviewResult, siteContent, publicContact] = await Promise.all([
    getPublicBusinessReviews(business.slug),
    getPublicSiteContent(business.slug),
    getPublicBusinessContact(business.slug),
  ]);
  const services = siteContent.services.filter((service) => service.isVisible);
  const galleryItems = siteContent.gallery.filter((item) => item.isVisible && item.imageUrl);
  const whatsappHref = publicContact.phoneE164 ? buildWhatsAppChatHref(
    publicContact.phoneE164,
    `Hola, quisiera consultar disponibilidad y reservas en ${business.name}.`,
  ) : null;

  const courtCount = business.venues.reduce((sum, venue) => sum + venue.courts.length, 0);
  const sportNames = [...new Set(business.venues.flatMap((venue) => venue.courts.map((court) => court.sportName)))];
  const pricedCourts = business.venues.flatMap((venue) => venue.courts).filter((court) => court.priceFrom !== null);
  const lowestPrice = pricedCourts.length ? Math.min(...pricedCourts.map((court) => court.priceFrom as number)) : null;
  const currency = pricedCourts[0]?.currency ?? "PEN";

  return (
    <div className="platform-page site-theme" style={themeCssVariables(siteContent.theme) as CSSProperties}>
      <StructuredData data={buildBusinessJsonLd(business)} />
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section
          className={business.coverImageUrl ? "platform-complex-hero platform-complex-hero--image" : "platform-complex-hero"}
        >
          {business.coverImageUrl ? (
            <Image
              className="platform-complex-hero__image"
              src={business.coverImageUrl}
              alt={business.coverAltText ?? `Instalaciones de ${business.name}`}
              fill
              sizes="100vw"
              preload
            />
          ) : null}
          <div className="shell platform-complex-hero__grid">
            <div>
              <nav className="platform-breadcrumbs" aria-label="Migas de pan"><ol><li><Link href="/">Inicio</Link></li><li aria-hidden="true">/</li><li><Link href="/buscar">Buscar canchas</Link></li><li aria-hidden="true">/</li><li aria-current="page">{business.name}</li></ol></nav>
              <span className="platform-live-label"><i aria-hidden="true" /> COMPLEJO EN LA PLATAFORMA</span>
              <div className="platform-complex-title-row">
                {business.logoUrl ? <span className="platform-complex-logo"><Image src={business.logoUrl} alt={`Logo de ${business.name}`} width={72} height={72} /></span> : null}
                <h1>{business.name}</h1>
                <FavoriteButton businessId={business.id} businessName={business.name} variant="button" />
              </div>
              <p>{business.city ?? "Ciudad por confirmar"}{business.country ? `, ${business.country}` : ""} · {sportNames.join(" · ") || "Deportes"}</p>
              <div className="platform-complex-hero__chips">
                {sportNames.slice(0, 4).map((sport) => <span key={sport}>{sport}</span>)}
                <span>{lowestPrice === null ? "Precio por consultar" : `Desde ${formatMoney(lowestPrice, currency)}/h`}</span>
                {business.reviewCount > 0 && business.ratingAverage !== null ? <span aria-label={`${business.ratingAverage.toFixed(1)} de 5, ${business.reviewCount} reseñas verificadas`}>★ {business.ratingAverage.toFixed(1)} · {business.reviewCount} {business.reviewCount === 1 ? "reseña" : "reseñas"}</span> : null}
              </div>
              <div className="platform-complex-contact">
                {whatsappHref ? <a className="button platform-whatsapp-contact" href={whatsappHref} target="_blank" rel="noreferrer">Contactar por WhatsApp ↗</a> : <small>Este complejo no publicó un WhatsApp de contacto.</small>}
              </div>
            </div>
            <div className="platform-complex-summary">
              <div><strong>{business.venues.length}</strong><span>{business.venues.length === 1 ? "sede" : "sedes"}</span></div>
              <div><strong>{courtCount}</strong><span>{courtCount === 1 ? "cancha" : "canchas"}</span></div>
            </div>
          </div>
        </section>

        <section className="platform-section">
          <div className="shell">
            <div className="platform-section__heading"><div><span className="eyebrow">SEDES Y CANCHAS</span><h2>Elige dónde jugar</h2></div></div>
            <div className="platform-venue-list">
              {business.venues.map((venue) => (
                <section className="platform-venue-card" key={venue.id}>
                  <header>
                    <div><h2>{venue.name}</h2><p>{venue.address ?? venue.city ?? "Ubicación por confirmar"}</p></div>
                    <div className="platform-venue-card__actions">
                      {venue.city ? <Badge tone="neutral">{venue.city}</Badge> : null}
                      {googleMapsSearchHref(venue) ? <a href={googleMapsSearchHref(venue) ?? undefined} target="_blank" rel="noreferrer">Cómo llegar ↗</a> : null}
                    </div>
                  </header>
                  <div className="platform-court-grid">
                    {venue.courts.map((court) => (
                      <article className="platform-court-card" key={court.id}>
                        <div className="platform-court-card__head">
                          <Badge tone="info">{court.sportName}</Badge>
                          <span>{court.surface ?? "Superficie por confirmar"}</span>
                        </div>
                        <h3>{court.name}</h3>
                        <p>{court.priceFrom === null ? "Precio por consultar" : `Desde ${formatMoney(court.priceFrom, court.currency)} por hora`}</p>
                        <Link className="button button--primary" href={`/reservar?negocio=${encodeURIComponent(business.slug)}&cancha=${encodeURIComponent(court.id)}`}>Ver disponibilidad <b aria-hidden="true">→</b></Link>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
        {services.length > 0 ? (
          <section className="platform-section platform-section--tenant-content" aria-labelledby="tenant-services-title">
            <div className="shell">
              <div className="platform-section__heading">
                <div><span className="eyebrow">SERVICIOS</span><h2 id="tenant-services-title">Lo que ofrece {business.name}</h2></div>
              </div>
              <div className="platform-service-grid">
                {services.map((service) => (
                  <article className="platform-service-card" key={service.id}>
                    <span className="platform-service-card__icon" aria-hidden="true"><Icon name={service.icon} size={24} /></span>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        {galleryItems.length > 0 ? (
          <section className="platform-section platform-section--tenant-gallery" aria-labelledby="tenant-gallery-title">
            <div className="shell">
              <div className="platform-section__heading">
                <div><span className="eyebrow">GALERÍA</span><h2 id="tenant-gallery-title">Conoce las instalaciones</h2></div>
              </div>
              <div className="platform-gallery-grid">
                {galleryItems.map((item) => (
                  <figure className="platform-gallery-card" key={item.id}>
                    <div className="platform-gallery-card__image" style={{ backgroundImage: `url(${item.imageUrl})` }} role="img" aria-label={item.altText || item.title} />
                    <figcaption><strong>{item.title}</strong>{item.altText ? <small>{item.altText}</small> : null}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        <section className="platform-section platform-section--reviews"><div className="shell"><PublicReviewsSection reviews={reviewResult.reviews} ratingAverage={business.ratingAverage} reviewCount={business.reviewCount} loadFailed={reviewResult.loadFailed} /></div></section>
      </main>
      <PlatformFooter />
    </div>
  );
}
