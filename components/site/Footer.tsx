import Link from "next/link";
import { businessConfig } from "@/config/business";

export function Footer() {
  const phoneDigits = businessConfig.phone.replace(/\D/g, "");
  const whatsappHref = `https://wa.me/51${phoneDigits}?text=${encodeURIComponent("Hola, quisiera consultar disponibilidad para reservar la cancha.")}`;

  return (
    <footer className="site-footer site-footer--commercial">
      <div className="shell commercial-footer">
        <div className="commercial-footer__brand">
          <strong><span>mi</span> valeibol</strong>
          <small>CLUB DE VOLEIBOL</small>
          <p>{businessConfig.address}</p>
        </div>

        <nav className="commercial-footer__nav" aria-label="Enlaces del pie de página">
          <a href="#inicio">Inicio</a>
          <a href="#galeria">Galería</a>
          <a href="#disponibilidad">Horarios</a>
          <a href="#servicios">Servicios</a>
          <a href="#precios">Precios</a>
          <a href="#ubicacion">Ubicación</a>
          <Link href="/privacidad">Privacidad</Link>
        </nav>

        <div className="commercial-footer__contact">
          <a className="footer-whatsapp" href={whatsappHref} target="_blank" rel="noreferrer">
            <span aria-hidden="true">●</span>
            Escríbenos por WhatsApp
          </a>
          <a href={`tel:+51${phoneDigits}`}>{businessConfig.phone}</a>
        </div>
      </div>

      <div className="shell commercial-footer__bottom">
        <small>© {new Date().getFullYear()} {businessConfig.name}. Todos los derechos reservados.</small>
        <span>{businessConfig.city}, {businessConfig.country}</span>
        <Link href="/admin/login">Administración</Link>
      </div>
    </footer>
  );
}
