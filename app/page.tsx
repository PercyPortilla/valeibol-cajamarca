import Link from "next/link";
import Image from "next/image";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import { getPublicPlatformCatalog, getPublicSports } from "@/lib/data/platformService";
import { groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";
import { Icon } from "@/components/ui/Icon";
import { StructuredData } from "@/components/platform/StructuredData";
import { buildMarketplaceJsonLd } from "@/lib/platform/seo";
import { getSportLandingPath } from "@/lib/platform/sportLanding";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Canchas y complejos deportivos",
  description: "Encuentra complejos deportivos, compara canchas y consulta disponibilidad por ciudad y deporte.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Canchas | Marketplace deportivo",
    description: "Descubre complejos deportivos, compara sedes y consulta canchas disponibles.",
    url: "/",
  },
};

export default async function PlatformHomePage() {
  const [catalog, activeSports] = await Promise.all([getPublicPlatformCatalog(), getPublicSports()]);
  const allBusinesses = groupCatalogByBusiness(catalog);
  const businesses = allBusinesses.slice(0, 6);
  const venueCount = new Set(catalog.map((item) => item.venueId)).size;
  const courtCount = new Set(catalog.map((item) => item.courtId)).size;
  const featuredBusiness = businesses[0];
  const sportCourtCounts = new Map<string, Set<string>>();
  for (const item of catalog) {
    const courtIds = sportCourtCounts.get(item.sportSlug) ?? new Set<string>();
    courtIds.add(item.courtId);
    sportCourtCounts.set(item.sportSlug, courtIds);
  }
  const quickSports = activeSports.filter((sport) => (sportCourtCounts.get(sport.slug)?.size ?? 0) > 0).slice(0, 3);

  return (
    <div className="platform-page platform-home">
      <StructuredData data={buildMarketplaceJsonLd(businesses)} />
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-home-hero">
          <div className="shell platform-home-hero__grid">
            <div className="platform-home-hero__copy">
              <span className="platform-live-label"><i aria-hidden="true" /> MARKETPLACE DEPORTIVO</span>
              <h1>Encuentra <span>tu próxima cancha.</span> Juega sin complicarte.</h1>
              <p>Descubre complejos, compara opciones y llega directo a la disponibilidad de cada cancha desde una sola plataforma.</p>
              <PlatformSearchForm />
              <div className="platform-hero-chips" aria-label="Accesos rápidos">
                <Link href="/buscar?ciudad=Cajamarca"><Icon name="location" size={16} /> Cajamarca</Link>
                {quickSports.map((sport) => (
                  <Link key={sport.id} href={getSportLandingPath(sport.slug)}><Icon name="ball" size={16} /> {sport.name}</Link>
                ))}
              </div>
            </div>
            <aside className="platform-home-hero__aside" aria-label="Resumen del marketplace">
              <div className="platform-showcase-card platform-showcase-card--main">
                <div
                  className={featuredBusiness?.coverImageUrl ? "platform-showcase-card__visual platform-showcase-card__visual--image" : "platform-showcase-card__visual"}
                  aria-hidden={featuredBusiness?.coverImageUrl ? undefined : true}
                >
                  {featuredBusiness?.coverImageUrl ? (
                    <Image
                      className="platform-showcase-card__cover"
                      src={featuredBusiness.coverImageUrl}
                      alt={featuredBusiness.coverAltText ?? `Instalaciones de ${featuredBusiness.name}`}
                      fill
                      sizes="(max-width: 1000px) 560px, 420px"
                      preload
                    />
                  ) : null}
                  <span>PLAY</span>
                  <div className="platform-showcase-court"><i /><b /></div>
                </div>
                <div className="platform-showcase-card__content">
                  <span className="eyebrow">DESCUBRE Y RESERVA</span>
                  <strong>{featuredBusiness?.name ?? "Complejos deportivos"}</strong>
                  <small>{featuredBusiness ? [featuredBusiness.city, ...featuredBusiness.sports].filter(Boolean).join(" · ") : "Explora complejos deportivos verificados"}</small>
                </div>
              </div>
              <div className="platform-market-stats">
                <div><strong>{allBusinesses.length}</strong><span>complejos</span></div>
                <div><strong>{venueCount}</strong><span>sedes</span></div>
                <div><strong>{courtCount}</strong><span>canchas</span></div>
              </div>
            </aside>
          </div>
        </section>

        <section className="platform-proof-strip" aria-label="Cómo funciona la plataforma">
          <div className="shell platform-proof-strip__inner">
            <div><span>01</span><p><strong>Busca</strong><small>por deporte y ciudad</small></p></div>
            <div><span>02</span><p><strong>Compara</strong><small>sedes, canchas y precios</small></p></div>
            <div><span>03</span><p><strong>Reserva</strong><small>desde el complejo elegido</small></p></div>
          </div>
        </section>

        <section className="platform-section platform-home-sports">
          <div className="shell">
            <div className="platform-section__heading">
              <div><span className="eyebrow">DEPORTES</span><h2>¿Qué quieres jugar?</h2></div>
              <Link className="text-link" href="/buscar">Ver todas las canchas →</Link>
            </div>
            <div className="platform-sport-grid">
              {activeSports.map((sport) => (
                <Link className={`platform-sport-card platform-sport-card--${sport.slug}`} key={sport.id} href={getSportLandingPath(sport.slug)}>
                  <span><Icon name={sport.slug === "voley" ? "net" : sport.slug === "basquet" ? "court" : "ball"} size={22} /></span>
                  <div>
                    <strong>{sport.name}</strong>
                    <small>{(sportCourtCounts.get(sport.slug)?.size ?? 0) > 0 ? `${sportCourtCounts.get(sport.slug)?.size} ${(sportCourtCounts.get(sport.slug)?.size ?? 0) === 1 ? "cancha disponible" : "canchas disponibles"}` : "Sin oferta activa todavía"}</small>
                  </div>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="platform-section platform-home-featured">
          <div className="shell">
            <div className="platform-section__heading">
              <div><span className="eyebrow">COMPLEJOS</span><h2>Complejos disponibles</h2><p>La oferta crecerá a medida que se incorporen nuevos negocios deportivos.</p></div>
            </div>
            <PlatformResults businesses={businesses} />
          </div>
        </section>

        <section className="platform-home-owner">
          <div className="shell platform-home-owner__inner">
            <div><span className="eyebrow">PARA PROPIETARIOS</span><h2>Administra reservas, precios y operación desde un solo panel.</h2><p>La misma plataforma pública se conecta con las herramientas operativas de cada negocio.</p></div>
            <Link className="button button--primary" href="/propietario">Ir al panel propietario</Link>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
