import Link from "next/link";
import { platformConfig } from "@/config/platform";

export function PlatformFooter() {
  return (
    <footer className="platform-footer">
      <div className="shell platform-footer__inner">
        <div><strong>{platformConfig.name} <em>•</em> Cajamarca</strong><span>Descubre complejos y encuentra dónde jugar en Cajamarca desde una sola plataforma.</span></div>
        <nav aria-label="Enlaces de plataforma">
          <Link href="/buscar">Buscar</Link>
          <Link href="/voley">Vóley</Link>
          <Link href="/futbol">Fútbol</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href="/admin/login">Administración</Link>
        </nav>
      </div>
    </footer>
  );
}
