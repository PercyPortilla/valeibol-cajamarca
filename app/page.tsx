import { AvailabilityCalendar } from "@/components/availability/AvailabilityCalendar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CourtVisual } from "@/components/site/CourtVisual";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { businessConfig } from "@/config/business";
import { getPublicCurrentPricing } from "@/lib/data/publicPricingService";
import { getPublicSiteContent } from "@/lib/data/publicSiteContentService";
import { formatMoney } from "@/lib/booking";

export default async function HomePage() {
  const [pricing, siteContent] = await Promise.all([
    getPublicCurrentPricing(),
    getPublicSiteContent(),
  ]);
  const services = siteContent.services.filter((service) => service.isVisible);
  const galleryItems = siteContent.gallery.filter((item) => item.isVisible);
  const pricingAvailable = pricing.withoutLights !== null && pricing.withLights !== null;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessConfig.address)}`;
  const mapsEmbedHref = `https://www.google.com/maps?q=${encodeURIComponent(businessConfig.address)}&output=embed`;
  const phoneDigits = businessConfig.phone.replace(/\D/g, "");
  const phoneHref = `tel:+51${phoneDigits}`;
  const whatsappHref = `https://wa.me/51${phoneDigits}?text=${encodeURIComponent("Hola, quisiera consultar disponibilidad para reservar la cancha.")}`;

  return (
    <>
      <Header />
      <main className="commercial-main">
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
                  <span aria-hidden="true">▣</span>
                  Reservar ahora
                </a>
                <a className="button button--hero-outline" href={phoneHref}>
                  <span aria-hidden="true">☎</span>
                  Llamar
                </a>
                <a className="button button--whatsapp" href={whatsappHref} target="_blank" rel="noreferrer">
                  <span aria-hidden="true">●</span>
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip shell" aria-label="Información principal">
          <div className="trust-item">
            <span className="trust-item__icon" aria-hidden="true">✓</span>
            <div><strong>Reserva por hora</strong><small>Elige un bloque disponible</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon" aria-hidden="true">◷</span>
            <div><strong>Disponibilidad en línea</strong><small>Consulta antes de solicitar</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon" aria-hidden="true">⌖</span>
            <div><strong>{businessConfig.address}</strong><small>Ubicación en Cajamarca</small></div>
          </div>
          <div className="trust-item">
            <span className="trust-item__icon" aria-hidden="true">☎</span>
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
            <AvailabilityCalendar />
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
                  <span className="feature-icon" aria-hidden="true">{service.icon}</span>
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
                    ? "Tarifas vigentes para hoy."
                    : pricingAvailable
                      ? "Precios referenciales para ayudarte a planificar."
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
                    <li>Reserva por bloques de una hora</li>
                  </ul>
                </Card>
                <Card className="price-card price-card--commercial price-card--light">
                  <Badge tone="warning">Con iluminación</Badge>
                  <span>Con iluminación</span>
                  <strong>{formatMoney(pricing.withLights!, pricing.currency)}<small>/hora</small></strong>
                  <ul className="price-benefits">
                    <li>Uso de cancha cubierta</li>
                    <li>Iluminación incluida en esta tarifa</li>
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
                <p>{galleryItems.some((item) => item.imageUrl) ? "Mira algunos espacios y detalles de la cancha." : "Las fotografías reales del local se incorporarán cuando estén disponibles."}</p>
              </div>
              <a href="#ubicacion" className="text-link">Ver ubicación <span aria-hidden="true">→</span></a>
            </div>
            <div className="gallery-grid gallery-grid--commercial">
              {galleryItems.map((item, index) => item.imageUrl ? (
                <figure className="gallery-media-card" key={item.id}>
                  <div className="gallery-media-card__image" style={{ backgroundImage: `url(${item.imageUrl})` }} role="img" aria-label={item.altText || item.title} />
                  <figcaption><strong>{item.title}</strong><small>{item.altText}</small></figcaption>
                </figure>
              ) : (
                <div className="gallery-placeholder gallery-placeholder--commercial" key={item.id}>
                  <span className="gallery-placeholder__number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>Imagen del local próximamente</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--commercial location-section" id="ubicacion">
          <div className="shell location-layout">
            <div className="location-copy">
              <span className="eyebrow">UBICACIÓN Y CONTACTO</span>
              <h2>Encuéntranos en Cajamarca</h2>
              <p>Consulta un horario disponible y contáctanos directamente si necesitas ayuda antes de reservar.</p>

              <div className="location-facts" id="contacto">
                <a href={mapsHref} target="_blank" rel="noreferrer">
                  <span aria-hidden="true">⌖</span>
                  <div><small>Dirección</small><strong>{businessConfig.address}</strong></div>
                </a>
                <a href={phoneHref}>
                  <span aria-hidden="true">☎</span>
                  <div><small>Teléfono</small><strong>{businessConfig.phone}</strong></div>
                </a>
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <span aria-hidden="true">●</span>
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
                <span aria-hidden="true">⌖</span>
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
    </>
  );
}
