import { AvailabilityCalendar } from "@/components/availability/AvailabilityCalendar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CourtVisual } from "@/components/site/CourtVisual";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { businessConfig } from "@/config/business";
import { getPublicCurrentPricing } from "@/lib/data/publicPricingService";
import { formatMoney } from "@/lib/booking";

const services = [
  { icon: "01", title: "Cancha cubierta", text: "Espacio deportivo techado para práctica de vóley." },
  { icon: "02", title: "Uso por hora", text: "Consulta bloques disponibles antes de contactar al negocio." },
  { icon: "03", title: "Iluminación opcional", text: "Tarifa diferenciada para uso sin luz o con iluminación." },
];

export default async function HomePage() {
  const pricing = await getPublicCurrentPricing();
  const pricingAvailable = pricing.withoutLights !== null && pricing.withLights !== null;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessConfig.address)}`;
  const phoneDigits = businessConfig.phone.replace(/\D/g, "");
  const phoneHref = `tel:+51${phoneDigits}`;
  const whatsappHref = `https://wa.me/51${phoneDigits}?text=${encodeURIComponent("Hola, quisiera consultar disponibilidad para reservar la cancha.")}`;

  return (
    <>
      <Header />
      <main>
        <section className="hero shell">
          <div className="hero__copy">
            <Badge tone="info">Cancha cubierta · Cajamarca</Badge>
            <h1>Mira primero qué hora está libre.</h1>
            <p>
              Consulta la semana completa, cambia de día desde tu celular y encuentra un horario disponible antes de solicitarlo.
            </p>
            <div className="hero__actions">
              <a className="button button--primary" href="#disponibilidad">Ver disponibilidad</a>
              <a className="button button--secondary" href="#precios">Ver precios</a>
            </div>
            <div className="hero__trust" aria-label="Datos principales">
              <span><strong>{pricingAvailable ? formatMoney(pricing.withoutLights!, pricing.currency) : "—"}</strong> sin luz / hora</span>
              <span><strong>{pricingAvailable ? formatMoney(pricing.withLights!, pricing.currency) : "—"}</strong> con luz / hora</span>
              <span><strong>7 días</strong> visibles por semana</span>
            </div>
          </div>
          <CourtVisual />
        </section>

        <section className="section section--raised availability-section" id="disponibilidad">
          <div className="shell">
            <div className="section-heading section-heading--availability">
              <div>
                <span className="eyebrow">CONSULTA PRIMERO, RESERVA DESPUÉS</span>
                <h2>Disponibilidad semanal</h2>
                <p>Revisa rápidamente los bloques disponibles y elige el horario que mejor te convenga antes de enviar tu solicitud.</p>
              </div>
              <div className="privacy-pill">Tus datos se solicitan solo al reservar</div>
            </div>
            <AvailabilityCalendar />
          </div>
        </section>

        <section className="section shell" id="precios">
          <div className="section-heading">
            <div>
              <span className="eyebrow">TARIFAS VIGENTES</span>
              <h2>Precios claros por hora.</h2>
              <p>{pricing.source === "supabase" ? "Tarifas vigentes para hoy." : pricing.source === "mock-provisional" ? "Precios referenciales para orientarte antes de solicitar." : "Consulta el precio aplicable al momento de solicitar tu horario."}</p>
            </div>
          </div>
          {pricingAvailable ? (
            <div className="price-grid">
              <Card className="price-card">
                <Badge tone={pricing.source === "supabase" ? "success" : "neutral"}>{pricing.source === "supabase" ? "Vigente" : "Referencial"}</Badge>
                <span>Sin luz</span>
                <strong>{formatMoney(pricing.withoutLights!, pricing.currency)}<small>/hora</small></strong>
                <p>Tarifa aplicable hoy para una hora de uso de cancha sin iluminación.</p>
              </Card>
              <Card className="price-card price-card--featured">
                <Badge tone="warning">Con iluminación</Badge>
                <span>Con luz</span>
                <strong>{formatMoney(pricing.withLights!, pricing.currency)}<small>/hora</small></strong>
                <p>Tarifa aplicable hoy para una hora de uso de cancha con iluminación.</p>
              </Card>
            </div>
          ) : (
            <Card className="price-card"><Badge tone="warning">Temporalmente no disponible</Badge><p>No mostramos una tarifa posiblemente desactualizada. Intenta nuevamente o confirma el precio al solicitar.</p></Card>
          )}
        </section>

        <section className="section section--soft" id="servicios">
          <div className="shell">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SERVICIOS</span>
                <h2>Lo esencial para jugar.</h2>
                <p>Solo se muestran características conocidas; no se inventan servicios no confirmados.</p>
              </div>
            </div>
            <div className="feature-grid">
              {services.map((service) => (
                <Card key={service.title}>
                  <span className="feature-icon">{service.icon}</span>
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="section shell" id="galeria">
          <div className="section-heading">
            <div>
              <span className="eyebrow">GALERÍA</span>
              <h2>Conoce el espacio.</h2>
              <p>Estamos preparando nuevas imágenes del local. Mientras tanto, puedes consultar horarios, precios y ubicación.</p>
            </div>
          </div>
          <div className="gallery-grid">
            {["Vista general", "Cancha", "Red", "Techo", "Iluminación", "Ingreso"].map((label, index) => (
              <div className="gallery-placeholder" key={label}>
                <span>0{index + 1}</span>
                <strong>{label}</strong>
                <small>Imagen próximamente</small>
              </div>
            ))}
          </div>
        </section>

        <section className="section section--soft" id="informacion">
          <div className="shell info-grid">
            <div>
              <span className="eyebrow">INFORMACIÓN</span>
              <h2>{businessConfig.name}</h2>
              <p className="info-lead">{businessConfig.category} en {businessConfig.city}. El sitio está diseñado para que disponibilidad y precios sean lo primero que el cliente pueda resolver.</p>
              <dl className="info-list">
                <div><dt>Ciudad</dt><dd>{businessConfig.city}, {businessConfig.country}</dd></div>
                <div><dt>Dirección</dt><dd>{businessConfig.address}</dd></div>
                <div><dt>Horario de atención</dt><dd>Consulta los bloques disponibles en el calendario</dd></div>
                <div><dt>Reserva</dt><dd>Envía tu solicitud desde un horario disponible y espera la confirmación</dd></div>
              </dl>
            </div>
            <CourtVisual />
          </div>
        </section>

        <section className="section shell" id="ubicacion">
          <div className="contact-panel">
            <div>
              <span className="eyebrow">UBICACIÓN Y CONTACTO</span>
              <h2>¿Encontraste un horario libre?</h2>
              <p>Si un bloque aparece disponible, puedes iniciar la solicitud digital desde el calendario. La solicitud queda pendiente hasta que el propietario la apruebe; también conservamos el contacto directo del negocio.</p>
            </div>
            <div className="contact-actions" id="contacto">
              <a className="button button--primary" href={whatsappHref} target="_blank" rel="noreferrer">Consultar por WhatsApp</a>
              <a className="button button--secondary" href={phoneHref}>Llamar al {businessConfig.phone}</a>
              <a className="button button--secondary" href={mapsHref} target="_blank" rel="noreferrer">Ver ubicación</a>
              <address>{businessConfig.address}</address>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
