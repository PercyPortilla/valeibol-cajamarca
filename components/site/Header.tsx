import Link from "next/link";
import { businessConfig } from "@/config/business";

export function Header() {
  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Link className="brand" href="/" aria-label={`${businessConfig.name}, inicio`}>
          <span className="brand__mark">V</span>
          <span>
            <strong>{businessConfig.shortName}</strong>
            <small>Cancha de vóley · {businessConfig.city}</small>
          </span>
        </Link>
        <nav className="site-nav" aria-label="Principal">
          <a className="site-nav__priority" href="#disponibilidad">Disponibilidad</a>
          <a className="site-nav__priority" href="#precios">Precios</a>
          <a className="site-nav__reserve" href="#disponibilidad">Reservar</a>
          <a className="site-nav__secondary" href="#servicios">Servicios</a>
          <a className="site-nav__secondary" href="#ubicacion">Ubicación</a>
          <Link className="site-nav__admin" href="/admin/login">Administración</Link>
        </nav>
      </div>
    </header>
  );
}
