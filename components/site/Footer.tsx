import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Icon } from "@/components/ui/Icon";
import { businessConfig } from "@/config/business";
import { buildWhatsAppChatHref } from "@/lib/whatsapp/links";

export function Footer({
  logoUrl,
  phoneE164,
  showGallery = true,
  showServices = true,
}: { logoUrl?: string | null; phoneE164?: string | null; showGallery?: boolean; showServices?: boolean } = {}) {
  const whatsappHref = phoneE164 ? buildWhatsAppChatHref(phoneE164, "Hola, quisiera consultar disponibilidad para reservar la cancha.") : null;

  return (
    <footer className="site-footer site-footer--commercial">
      <div className="shell commercial-footer">
        <div className="commercial-footer__brand">
          <BrandLogo context="footer" logoUrl={logoUrl} name={businessConfig.name} />
          <p>{businessConfig.address}</p>
        </div>

        <nav className="commercial-footer__nav" aria-label="Enlaces del pie de página">
          <a href="#inicio">Inicio</a>
          {showGallery ? <a href="#galeria">Galería</a> : null}
          <a href="#disponibilidad">Horarios</a>
          {showServices ? <a href="#servicios">Servicios</a> : null}
          <a href="#precios">Precios</a>
          <a href="#ubicacion">Ubicación</a>
          <Link href="/privacidad">Privacidad</Link>
        </nav>

        <div className="commercial-footer__contact">
          {whatsappHref ? <a className="footer-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer">
            <Icon name="whatsapp" size={18} />
            Escríbenos por WhatsApp
          </a> : null}
          {phoneE164 ? <a href={`tel:${phoneE164}`}>{phoneE164}</a> : <small>Contacto por publicar</small>}
        </div>
      </div>

      <div className="shell commercial-footer__bottom">
        <small>© {new Date().getFullYear()} {businessConfig.name}. Todos los derechos reservados.</small>
        <span>{businessConfig.city}, {businessConfig.country}</span>
        <Link href="/">Explorar SportCenter Caxas</Link>
        <Link href={`/complejo/${businessConfig.slug}/administrar`}>Acceso del propietario</Link>
      </div>
    </footer>
  );
}
