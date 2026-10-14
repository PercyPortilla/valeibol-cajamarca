import Link from "next/link";
import { businessConfig } from "@/config/business";

export function Header() {
  return (
    <header className="site-header site-header--commercial">
      <div className="shell site-header__inner">
        <Link className="brand brand--commercial" href="#inicio" aria-label={`${businessConfig.name}, inicio`}>
          <span className="brand__symbol" aria-hidden="true">◉</span>
          <span className="brand__word">
            <small>mi</small>
            <strong>valeibol</strong>
            <em>CLUB DE VOLEIBOL</em>
          </span>
        </Link>

        <nav className="site-nav site-nav--commercial" aria-label="Principal">
          <a href="#inicio">Inicio</a>
          <a href="#galeria">Galería</a>
          <a href="#disponibilidad">Horarios</a>
          <a href="#servicios">Servicios</a>
          <a href="#precios">Precios</a>
          <a href="#ubicacion">Ubicación</a>
          <a href="#contacto">Contacto</a>
          <a className="site-nav__reserve" href="#disponibilidad">
            <span aria-hidden="true">▣</span>
            Reservar ahora
          </a>
        </nav>
      </div>
    </header>
  );
}
