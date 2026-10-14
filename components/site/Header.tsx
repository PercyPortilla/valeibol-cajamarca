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
          <a href="#disponibilidad">Disponibilidad</a>
          <a href="#precios">Precios</a>
          <a href="#servicios">Servicios</a>
          <a href="#ubicacion">Ubicación</a>
          <Link className="site-nav__admin" href="/admin/login">Administración</Link>
        </nav>
      </div>
    </header>
  );
}
