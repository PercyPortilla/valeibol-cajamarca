import { AvailabilityCalendar } from "@/components/availability/AvailabilityCalendar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CourtVisual } from "@/components/site/CourtVisual";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Icon } from "@/components/ui/Icon";
import { businessConfig } from "@/config/business";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { demoCourt } from "@/lib/data/demoPlatform";
import { getPublicCurrentPricing } from "@/lib/data/publicPricingService";
import { getPublicSiteContent } from "@/lib/data/publicSiteContentService";
import { formatMoney } from "@/lib/booking";
import { themeCssVariables } from "@/lib/siteContent";
import type { CSSProperties } from "react";
import { FavoriteButton } from "@/components/platform/FavoriteButton";
import { PublicReviewsSection } from "@/components/platform/PublicReviewsSection";
import { getPublicBusinessReviews } from "@/lib/data/reputationService";

export async function ValeibolLanding() {
  const [pricing, siteContent, catalog, reviewResult] = await Promise.all([
    getPublicCurrentPricing(),
    getPublicSiteContent(),
    getPublicPlatformCatalog({ businessSlug: businessConfig.slug }),
    getPublicBusinessReviews(businessConfig.slug),
  ]);
  const initialCourtId = catalog[0]?.courtId ?? demoCourt.id;
  const businessId = catalog[0]?.businessId ?? null;
  const ratingAverage = catalog[0]?.ratingAverage ?? null;
  const reviewCount = catalog[0]?.reviewCount ?? 0;
  const courtSports = Object.fromEntries(catalog.map((item) => [item.courtId, item.sportSlug]));
  if (catalog.length === 0) courtSports[demoCourt.id] = "voley";
  const services = siteContent.services.filter((service) => service.isVisible);
  const configuredGalleryItems = siteContent.gallery.filter((item) => item.isVisible && item.imageUrl);
  const galleryItems = configuredGalleryItems.length > 0 ? configuredGalleryItems : [
    {
      id: "valeibol-wide",
      title: "Vista de la cancha",
      imageUrl: "/images/valeibol-court-wide.webp",
      altText: "Vista amplia de las instalaciones de mi valeibol",
      sortOrder: 10,
      isVisible: true,
    },
    {
      id: "valeibol-portrait",
      title: "Instalaciones",
      imageUrl: "/images/valeibol-court-portrait.webp",
      altText: "Vista vertical de las instalaciones de mi valeibol",
      sortOrder: 20,
      isVisible: true,
    },
  ];
  const pricingAvailable = pricing.withoutLights !== null && pricing.withLights !== null;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessConfig.address)}`;
  const mapsEmbedHref = `https://www.google.com/maps?q=${encodeURIComponent(businessConfig.address)}&output=embed`;
  const phoneDigits = businessConfig.phone.replace(/\D/g, "");
  const phoneHref = `tel:+51${phoneDigits}`;
  const whatsappHref = `https://wa.me/51${phoneDigits}?text=${encodeURIComponent("Hola, quisiera consultar disponibilidad para reservar la cancha.")}`;

  return (
    <div className="site-theme" style={themeCssVariables(siteContent.theme) as CSSProperties}>
      <Header />
      <main className="commercial-main" id="valeibol-main" tabIndex={-1}>
        <section className="hero hero--commercial" id="inicio">
          <div className="hero-commercial__media">
            <CourtVisual />
          </div>
          <div className="hero-commercial__shade" aria-hidden="true" />
          <div className="shell hero-commercial__inner">
            <div className="hero-commercial__copy">
              <span className="hero-commercial__eyebrow">CLUB DE VOLEIBOL EN CAJAMARCA</span>
              <h1>Reserva tu cancha <span>de vóley</span> en Cajamarca</h1>
              <p>
                Revisa horarios disponibles, conoce la tarifa vigente y envía tu solicitud de reserva en pocos pasos.
              </p>
              <div className="hero__actions hero-commercial__actions">
                <a className="button button--primary" href="#disponibilidad">
                  <Icon name="calendar" size={18} />
                  Reservar ahora
                </a>
                <a className="button button--hero-outline" href={phoneHref}>
                  <Icon name="phone" size={18} />
                  Llamar
                </a>
                <a className="button button--whatsapp" href={whatsappHref} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" size={18} />
                  WhatsApp
                </a>
                {businessId ? <FavoriteButton businessId={businessId} businessName={businessConfig.name} variant="button" /> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip shell" aria-label="Información principal">
          <div className="trust-item">
            <span className="trust-item__icon"><Icon name="check" size={20} /></span>
            <div><strong>Reserva por hora</strong><small>Elige un bloque disponible</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon"><Icon name="clock" size={20} /></span>
            <div><strong>Disponibilidad en línea</strong><small>Consulta antes de solicitar</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon"><Icon name="location" size={20} /></span>
            <div><strong>{businessConfig.address}</strong><small>Ubicación en Cajamarca</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon"><Icon name="phone" size={20} /></span>
            <div><strong>{businessConfig.phone}</strong><small>Llámanos o escríbenos por WhatsApp</small></div>
          </div>
        </section>

        <section className="section section--commercial availability-section" id="disponibilidad">
          <div className="shell">
            <div className="section-heading section-heading--commercial section-heading--availability">
              <div>
                <span className="eyebrow">HORARIOS</span>
                <h2>Horarios disponibles</h2>
                <p>Selecciona un día, revisa los bloques y solicita el horario que más te convenga.</p>
              </div>
              <div className="privacy-pill">Tus datos se solicitan solo al reservar</div>
            </div>
            <AvailabilityCalendar
              businessSlug={businessConfig.slug}
              businessTimezone={businessConfig.timezone}
              initialCourtId={initialCourtId}
              courtSports={courtSports}
            />
          </div>
        </section>

        <section className="section section--commercial section--services" id="servicios">
          <div className="shell">
            <div className="section-heading section-heading--commercial">
              <div>
                <span className="eyebrow">SERVICIOS</span>
                <h2>Servicios incluidos</h2>
                <p>Más comodidad, mejor ambiente y todo lo necesario para disfrutar tu turno.</p>
              </div>
            </div>
            <div className="feature-grid feature-grid--commercial">
              {services.map((service) => (
                <Card key={service.id} className="service-card">
                  <span className="feature-icon"><Icon name={service.icon} size={26} /></span>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--commercial price-section" id="precios">
          <div className="shell price-layout">
            <div className="section-heading section-heading--commercial price-layout__intro">
              <div>
                <span className="eyebrow">PRECIOS</span>
                <h2>Tarifas por hora</h2>
                <p>
                  {pricing.source === "supabase"
                    ? "La tarifa se asigna automáticamente según la hora de inicio: de 07:00 a 17:59 sin luz; desde las 18:00 con luz."
                    : pricingAvailable
                      ? "Precios referenciales. La iluminación se asigna automáticamente según el horario."
                      : "Consulta el precio aplicable al momento de solicitar tu horario."}
                </p>
              </div>
            </div>

            {pricingAvailable ? (
              <div className="price-grid price-grid--commercial">
                <Card className="price-card price-card--commercial price-card--featured">
                  <Badge tone={pricing.source === "supabase" ? "success" : "neutral"}>
                    {pricing.source === "supabase" ? "Tarifa vigente" : "Referencial"}
                  </Badge>
                  <span>Sin iluminación</span>
                  <strong>{formatMoney(pricing.withoutLights!, pricing.currency)}<small>/hora</small></strong>
                  <ul className="price-benefits">
                    <li>Uso de cancha cubierta</li>
                    <li>Aplica a reservas que empiezan de 07:00 a 17:59</li>
                  </ul>
                </Card>
                <Card className="price-card price-card--commercial price-card--light">
                  <Badge tone="warning">Con iluminación</Badge>
                  <span>Con iluminación</span>
                  <strong>{formatMoney(pricing.withLights!, pricing.currency)}<small>/hora</small></strong>
                  <ul className="price-benefits">
                    <li>Uso de cancha cubierta</li>
                    <li>Se aplica automáticamente desde las 18:00</li>
                  </ul>
                </Card>
              </div>
            ) : (
              <Card className="price-card price-card--commercial">
                <Badge tone="warning">Consultar tarifa</Badge>
                <p>La tarifa no está disponible en este momento. Confírmala al solicitar tu horario.</p>
              </Card>
            )}
          </div>
        </section>

        <section className="section section--commercial gallery-section" id="galeria">
          <div className="shell">
            <div className="section-heading section-heading--commercial gallery-heading">
              <div>
                <span className="eyebrow">GALERÍA</span>
                <h2>Conoce nuestras instalaciones</h2>
                <p>Mira algunos espacios y detalles reales de la cancha.</p>
              </div>
              <a href="#ubicacion" className="text-link">Ver ubicación <span aria-hidden="true">→</span></a>
            </div>
            <div className="gallery-grid gallery-grid--commercial">
              {galleryItems.map((item) => item.imageUrl ? (
                <figure className="gallery-media-card" key={item.id}>
                  <div className="gallery-media-card__image" style={{ backgroundImage: `url(${item.imageUrl})` }} role="img" aria-label={item.altText || item.title} />
                  <figcaption><strong>{item.title}</strong><small>{item.altText}</small></figcaption>
                </figure>
              ) : null)}
            </div>
          </div>
        </section>

        <section className="section section--commercial valeibol-reviews-section" id="resenas">
          <div className="shell"><PublicReviewsSection reviews={reviewResult.reviews} ratingAverage={ratingAverage} reviewCount={reviewCount} loadFailed={reviewResult.loadFailed} /></div>
        </section>

        <section className="section section--commercial location-section" id="ubicacion">
          <div className="shell location-layout">
            <div className="location-copy">
              <span className="eyebrow">UBICACIÓN Y CONTACTO</span>
              <h2>Encuéntranos en Cajamarca</h2>
              <p>Consulta un horario disponible y contáctanos directamente si necesitas ayuda antes de reservar.</p>

              <div className="location-facts" id="contacto">
                <a href={mapsHref} target="_blank" rel="noreferrer">
                  <span><Icon name="location" size={20} /></span>
                  <div><small>Dirección</small><strong>{businessConfig.address}</strong></div>
                </a>
                <a href={phoneHref}>
                  <span><Icon name="phone" size={20} /></span>
                  <div><small>Teléfono</small><strong>{businessConfig.phone}</strong></div>
                </a>
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <span><Icon name="whatsapp" size={20} /></span>
                  <div><small>WhatsApp</small><strong>Consultar disponibilidad</strong></div>
                </a>
              </div>

              <div className="location-actions">
                <a className="button button--primary" href="#disponibilidad">Reservar ahora</a>
                <a className="button button--commercial-outline" href={mapsHref} target="_blank" rel="noreferrer">Abrir en Google Maps</a>
              </div>
            </div>

            <div className="map-card">
              <iframe
                src={mapsEmbedHref}
                title={`Mapa de ${businessConfig.name} en Cajamarca`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a className="map-card__label" href={mapsHref} target="_blank" rel="noreferrer">
                <span><Icon name="location" size={20} /></span>
                <div>
                  <strong>{businessConfig.name}</strong>
                  <small>{businessConfig.address}</small>
                </div>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
