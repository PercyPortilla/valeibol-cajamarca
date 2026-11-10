import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Icon } from "@/components/ui/Icon";
import { businessConfig } from "@/config/business";

export function Header({
  logoUrl,
  showGallery = true,
  showServices = true,
}: { logoUrl?: string | null; showGallery?: boolean; showServices?: boolean } = {}) {
  return (
    <header className="site-header site-header--commercial">
      <a className="platform-skip-link" href="#valeibol-main">Saltar al contenido principal</a>
      <div className="site-header__parent">
        <div className="shell">
          <Link href="/">← Volver a SportCenter Caxas</Link>
          <span>Página del complejo · Cajamarca</span>
        </div>
      </div>
      <div className="shell site-header__inner">
        <Link className="brand brand--commercial" href="#inicio" aria-label={`${businessConfig.name}, inicio`}>
          <BrandLogo logoUrl={logoUrl} name={businessConfig.name} />
        </Link>

        <nav className="site-nav site-nav--commercial" aria-label="Principal">
          <a href="#inicio">Inicio</a>
          {showGallery ? <a href="#galeria">Galería</a> : null}
          <a href="#disponibilidad">Horarios</a>
          {showServices ? <a href="#servicios">Servicios</a> : null}
          <a href="#precios">Precios</a>
          <a href="#ubicacion">Ubicación</a>
          <a href="#contacto">Contacto</a>
          <a className="site-nav__reserve" href="#disponibilidad">
            <Icon name="calendar" size={18} />
            Consultar horarios
          </a>
        </nav>
      </div>
    </header>
  );
}
