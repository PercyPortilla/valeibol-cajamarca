import Link from "next/link";
import Image from "next/image";
import { platformConfig } from "@/config/platform";

export function PlatformHeader({ premium = false }: { premium?: boolean }) {
  return (
    <header className={premium ? "platform-header platform-header--premium" : "platform-header"}>
      <a className="platform-skip-link" href="#platform-main">Saltar al contenido principal</a>
      <div className="shell platform-header__inner">
        <Link className="platform-brand" href="/" aria-label={`Ir al inicio de ${platformConfig.name}`}>
          {premium ? (
            <>
              <span className="platform-brand__premium-logo">
                <Image
                  src="/images/caxas-sportcenter-logo.webp"
                  alt="Caxas SportCenter"
                  width={240}
                  height={160}
                  sizes="(max-width: 680px) 96px, 120px"
                  priority
                />
              </span>
              <span className="platform-brand__premium-copy"><small>Plataforma deportiva · Cajamarca</small></span>
            </>
          ) : (
            <>
              <span className="platform-brand__mark" aria-hidden="true"><i>C</i></span>
              <span><strong>{platformConfig.name}</strong><small>Plataforma deportiva · Cajamarca</small></span>
            </>
          )}
        </Link>
        <nav className="platform-nav" aria-label="Navegación de la plataforma deportiva">
          <Link href="/buscar">{premium ? "Explorar" : "Buscar"}</Link>
          <Link href="/#deportes">Deportes</Link>
          <Link href="/#complejos">Complejos</Link>
          <Link href="/mi-cuenta">Mi cuenta</Link>
        </nav>
      </div>
    </header>
  );
}
