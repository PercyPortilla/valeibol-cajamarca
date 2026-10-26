import Link from "next/link";
import { platformConfig } from "@/config/platform";

export function PlatformHeader() {
  return (
    <header className="platform-header">
      <a className="platform-skip-link" href="#platform-main">Saltar al contenido principal</a>
      <div className="shell platform-header__inner">
        <Link className="platform-brand" href="/" aria-label={`Ir al inicio de ${platformConfig.name}`}>
          <span className="platform-brand__mark" aria-hidden="true"><i>C</i></span>
          <span><strong>{platformConfig.name}</strong><small>Canchas en Cajamarca</small></span>
        </Link>
        <nav className="platform-nav" aria-label="Navegación de la plataforma deportiva">
          <Link href="/buscar">Buscar</Link>
          <Link href="/voley">Vóley</Link>
          <Link href="/futbol">Fútbol</Link>
          <Link href="/mi-cuenta">Mi cuenta</Link>
          <Link className="platform-nav__featured" href="/buscar">Cajamarca</Link>
        </nav>
      </div>
    </header>
  );
}
