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
import { getPublicBusinessContact } from "@/lib/data/publicBusinessContactService";
import { PublicReviewsSection } from "@/components/platform/PublicReviewsSection";
import { getPublicBusinessReviews } from "@/lib/data/reputationService";
import { buildWhatsAppChatHref } from "@/lib/whatsapp/links";

export async function ValeibolLanding() {
  const [pricing, siteContent, catalog, reviewResult, publicContact] = await Promise.all([
    getPublicCurrentPricing(),
    getPublicSiteContent(),
    getPublicPlatformCatalog({ businessSlug: businessConfig.slug }),
    getPublicBusinessReviews(businessConfig.slug),
    getPublicBusinessContact(businessConfig.slug),
  ]);
  const initialCourtId = catalog[0]?.courtId ?? demoCourt.id;
  const businessLogoUrl = catalog[0]?.logoUrl ?? null;
  const ratingAverage = catalog[0]?.ratingAverage ?? null;
  const reviewCount = catalog[0]?.reviewCount ?? 0;
  const courtSports = Object.fromEntries(catalog.map((item) => [item.courtId, [{ slug: item.sportSlug, name: item.sportName }]]));
  if (catalog.length === 0) courtSports[demoCourt.id] = [{ slug: "voley", name: "Vóley" }];
  const services = siteContent.services.filter((service) => service.isVisible);
  const configuredGalleryItems = siteContent.gallery.filter((item) => item.isVisible && item.imageUrl);
  const galleryItems = siteContent.source === "default" ? [
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
  ] : configuredGalleryItems;
  const pricingAvailable = pricing.withoutLights !== null && pricing.withLights !== null;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessConfig.address)}`;
  const mapsEmbedHref = `https://www.google.com/maps?q=${encodeURIComponent(businessConfig.address)}&output=embed`;
  const phoneE164 = publicContact.phoneE164;
  const phoneHref = phoneE164 ? `tel:${phoneE164}` : null;
  const whatsappHref = phoneE164
    ? buildWhatsAppChatHref(phoneE164, "Hola, quisiera consultar disponibilidad para reservar la cancha.")
    : null;

  return (
    <div className="site-theme site-theme--caxas-child" style={themeCssVariables(siteContent.theme) as CSSProperties}>
      <Header logoUrl={businessLogoUrl} showGallery={galleryItems.length > 0} showServices={services.length > 0} />
      <main className="commercial-main" id="valeibol-main" tabIndex={-1}>
        <section className="hero hero--commercial" id="inicio">
          <div className="hero-commercial__media">
            <CourtVisual />
          </div>
          <div className="hero-commercial__shade" aria-hidden="true" />
          <div className="shell hero-commercial__inner">
            <div className="hero-commercial__copy">
              <span className="hero-commercial__eyebrow">VÓLEY EN CAJAMARCA · VALEIBOL</span>
              <h1>Tu próxima partida <span>de vóley</span> empieza aquí</h1>
              <p>
                Revisa horarios y tarifas, y consulta tu reserva directamente por WhatsApp. No necesitas registrarte.
              </p>
              <div className="hero__actions hero-commercial__actions">
                <a className="button button--primary" href="#disponibilidad">
                  <Icon name="calendar" size={18} />
                  Consultar horarios
                </a>
                {phoneHref ? <a className="button button--hero-outline" href={phoneHref}>
                  <Icon name="phone" size={18} />
                  Llamar
                </a> : null}
                {whatsappHref ? <a className="button button--whatsapp" href={whatsappHref} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" size={18} />
                  WhatsApp
                </a> : null}
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip shell" aria-label="Información principal">
          <div className="trust-item">
            <span className="trust-item__icon"><Icon name="check" size={20} /></span>
            <div><strong>Consulta por hora</strong><small>Selecciona el horario que te interese</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon"><Icon name="clock" size={20} /></span>
            <div><strong>Agenda para consultar</strong><small>Confirma el horario por WhatsApp</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon"><Icon name="location" size={20} /></span>
            <div><strong>{businessConfig.address}</strong><small>Ubicación en Cajamarca</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon"><Icon name="phone" size={20} /></span>
            <div><strong>{phoneE164 ?? "Contacto por publicar"}</strong><small>Confirma directamente con el complejo</small></div>
          </div>
        </section>

        <section className="section section--commercial availability-section" id="disponibilidad">
          <div className="shell">
            <div className="section-heading section-heading--commercial section-heading--availability">
              <div>
                <span className="eyebrow">HORARIOS</span>
                <h2>Explora los horarios</h2>
                <p>Selecciona un día y consulta por WhatsApp el horario que más te convenga.</p>
              </div>
              <div className="privacy-pill">Sin registro · Atención por WhatsApp</div>
            </div>
            <AvailabilityCalendar
              businessSlug={businessConfig.slug}
              businessName={businessConfig.name}
              businessTimezone={businessConfig.timezone}
              initialCourtId={initialCourtId}
              courtSports={courtSports}
              contactPhoneE164={publicContact.phoneE164}
            />
          </div>
        </section>

        {services.length > 0 ? <section className="section section--commercial section--services" id="servicios">
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
        </section> : null}

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

        {galleryItems.length > 0 ? <section className="section section--commercial gallery-section" id="galeria">
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
        </section> : null}

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
                {phoneHref ? <a href={phoneHref}>
                  <span><Icon name="phone" size={20} /></span>
                  <div><small>Teléfono</small><strong>{phoneE164}</strong></div>
                </a> : null}
                {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <span><Icon name="whatsapp" size={20} /></span>
                  <div><small>WhatsApp</small><strong>Consultar disponibilidad</strong></div>
                </a> : null}
              </div>

              <div className="location-actions">
                <a className="button button--primary" href="#disponibilidad">Consultar horarios</a>
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
      <Footer logoUrl={businessLogoUrl} phoneE164={phoneE164} showGallery={galleryItems.length > 0} showServices={services.length > 0} />
    </div>
  );
}
