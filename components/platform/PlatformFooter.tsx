import Link from "next/link";
import { CaxasChromeBrand } from "@/components/brand/CaxasChromeBrand";

export function PlatformFooter({ businessSlug }: { businessSlug?: string } = {}) {
  return (
    <footer className="platform-footer">
      <div className="shell platform-footer__inner">
        <div className="platform-footer__brand">
          <CaxasChromeBrand compact />
          <span>Descubre complejos y encuentra dónde jugar en Cajamarca desde una sola plataforma.</span>
        </div>
        <nav aria-label="Enlaces de plataforma">
          <Link href="/buscar">Buscar</Link>
          <Link href="/voley">Vóley</Link>
          <Link href="/futbol">Fútbol</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href={businessSlug ? `/complejo/${encodeURIComponent(businessSlug)}/administrar` : "/admin/login?next=%2Fadmin-global"}>
            {businessSlug ? "Administración del negocio" : "Administración"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
