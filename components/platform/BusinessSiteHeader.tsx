import Image from "next/image";
import Link from "next/link";

type Props = {
  businessName: string;
  businessSlug: string;
  logoUrl: string | null;
  sports?: string[];
  hasServices?: boolean;
  hasGallery?: boolean;
  reservation?: boolean;
};

/** Identidad exclusiva de la página hija: no incorpora el logo ni menú de CAXAS. */
export function BusinessSiteHeader({
  businessName, businessSlug, logoUrl, sports = [], hasServices = false, hasGallery = false, reservation = false,
}: Props) {
  const root = `/complejo/${encodeURIComponent(businessSlug)}`;
  return (
    <header className="business-site-header">
      <a className="platform-skip-link" href="#platform-main">Saltar al contenido principal</a>
      <div className="shell business-site-header__inner">
        <Link href={root} className="business-site-header__brand" aria-label={`Inicio de ${businessName}`}>
          {logoUrl ? <span className="business-site-header__logo"><Image src={logoUrl} width={65} height={65} alt={`Escudo de ${businessName}`} /></span> :
            <span className="business-site-header__monogram" aria-hidden="true">{businessName.trim().slice(0,1)}</span>}
          <span className="business-site-header__identity">
            <strong>{businessName}</strong>
            <small>{sports.length ? sports.join(" · ") : "Complejo deportivo"}</small>
          </span>
        </Link>
        <nav aria-label={`Secciones de ${businessName}`} className="business-site-header__nav">
          <Link href={`${root}#canchas`}>Campos</Link>
          {!reservation && hasServices ? <a href="#servicios">Servicios</a> : null}
          {!reservation && hasGallery ? <a href="#galeria">Galería</a> : null}
          <Link className="business-site-header__primary" href={reservation ? root : `/reservar?negocio=${encodeURIComponent(businessSlug)}`}>
            {reservation ? "Volver al complejo" : "Consultar horarios"} <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
