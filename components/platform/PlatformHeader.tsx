import Link from "next/link";

export function PlatformHeader() {
  return (
    <header className="platform-header">
      <a className="platform-skip-link" href="#platform-main">Saltar al contenido principal</a>
      <div className="shell platform-header__inner">
        <Link className="platform-brand" href="/buscar" aria-label="Explorar canchas deportivas">
          <span className="platform-brand__mark" aria-hidden="true">C</span>
          <span><strong>Canchas</strong><small>Reservas deportivas</small></span>
        </Link>
        <nav className="platform-nav" aria-label="Navegación de la plataforma deportiva">
          <Link href="/buscar">Buscar</Link>
          <Link href="/voley">Vóley</Link>
          <Link href="/futbol">Fútbol</Link>
          <Link href="/mi-cuenta">Mi cuenta</Link>
          <Link href="/complejo/valeibol-cajamarca">Valeibol actual</Link>
        </nav>
      </div>
    </header>
  );
}
