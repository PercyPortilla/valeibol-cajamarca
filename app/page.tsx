import Link from "next/link";
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
import { platformConfig } from "@/config/platform";

export const metadata: Metadata = {
  title: "Canchas y complejos deportivos en Cajamarca",
  description: `Encuentra complejos deportivos en ${platformConfig.city}, compara canchas y consulta disponibilidad por deporte.`,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${platformConfig.name} | Canchas en Cajamarca`,
    description: "Descubre complejos deportivos de Cajamarca, compara sedes y consulta canchas disponibles.",
    url: "/",
  },
};

export default async function PlatformHomePage() {
  const [catalog, activeSports] = await Promise.all([getPublicPlatformCatalog(), getPublicSports()]);
  const allBusinesses = groupCatalogByBusiness(catalog);
  const businesses = allBusinesses.slice(0, 6);
  const venueCount = new Set(catalog.map((item) => item.venueId)).size;
  const courtCount = new Set(catalog.map((item) => item.courtId)).size;
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
              <span className="platform-live-label"><i aria-hidden="true" /> {platformConfig.name.toUpperCase()}</span>
              <h1>Encuentra <span>tu próxima cancha en Cajamarca.</span> Juega sin complicarte.</h1>
              <p>Descubre complejos de Cajamarca, compara opciones y llega directo a la disponibilidad de cada cancha desde una sola plataforma.</p>
              <PlatformSearchForm />
              <div className="platform-hero-chips" aria-label="Accesos rápidos">
                <Link href="/buscar"><Icon name="location" size={16} /> Cajamarca</Link>
                {quickSports.map((sport) => (
                  <Link key={sport.id} href={getSportLandingPath(sport.slug)}><Icon name="ball" size={16} /> {sport.name}</Link>
                ))}
              </div>
            </div>
            <aside className="platform-home-hero__aside" aria-label="Resumen del marketplace">
              <div className="platform-showcase-card platform-showcase-card--main">
                <div className="platform-showcase-card__visual" aria-hidden="true">
                  <span>SPORTCENTER</span>
                  <div className="platform-showcase-court"><i /><b /></div>
                </div>
                <div className="platform-showcase-card__content">
                  <span className="eyebrow">PLATAFORMA GENERAL</span>
                  <strong>Complejos deportivos de Cajamarca</strong>
                  <small>Explora negocios, deportes y canchas desde una sola plataforma.</small>
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
            <div><span>01</span><p><strong>Busca</strong><small>por deporte en Cajamarca</small></p></div>
            <div><span>02</span><p><strong>Compara</strong><small>sedes, canchas y precios</small></p></div>
            <div><span>03</span><p><strong>Reserva</strong><small>desde el complejo elegido</small></p></div>
          </div>
        </section>

        <section className="platform-section platform-home-sports" id="deportes">
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

        <section className="platform-section platform-home-featured" id="complejos">
          <div className="shell">
            <div className="platform-section__heading">
              <div><span className="eyebrow">COMPLEJOS EN CAJAMARCA</span><h2>Complejos disponibles</h2><p>Por ahora la plataforma está enfocada únicamente en Cajamarca.</p></div>
            </div>
            <PlatformResults businesses={businesses} />
          </div>
        </section>

        <section className="platform-home-owner">
          <div className="shell platform-home-owner__inner">
            <div><span className="eyebrow">PARA PROPIETARIOS DE CAJAMARCA</span><h2>Administra reservas, precios y operación desde un solo panel.</h2><p>Cada negocio gestiona únicamente su propia operación dentro de SportCenter Caxas.</p></div>
            <Link className="button button--primary" href="/propietario">Ir al panel propietario</Link>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
