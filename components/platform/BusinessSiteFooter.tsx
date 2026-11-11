import Image from "next/image";
import Link from "next/link";

export function BusinessSiteFooter({ businessName, businessSlug, logoUrl, sports = [] }: {
  businessName: string; businessSlug: string; logoUrl: string | null; sports?: string[];
}) {
  const root = `/complejo/${encodeURIComponent(businessSlug)}`;
  return (
    <footer className="business-site-footer">
      <div className="shell business-site-footer__inner">
        <div className="business-site-footer__identity">
          {logoUrl ? <Image src={logoUrl} width={44} height={44} alt="" /> : null}
          <span><strong>{businessName}</strong><small>{sports.length ? sports.join(" · ") : "Complejo deportivo"}</small></span>
        </div>
        <nav aria-label="Enlaces del complejo">
          <Link href={root}>Inicio</Link>
          <Link href={`${root}#canchas`}>Campos</Link>
          <Link href={`/reservar?negocio=${encodeURIComponent(businessSlug)}`}>Horarios</Link>
          <Link href="/privacidad">Privacidad</Link>
          <Link href={`${root}/administrar`}>Administración</Link>
        </nav>
      </div>
    </footer>
  );
}
