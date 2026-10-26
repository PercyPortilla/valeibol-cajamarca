import Link from "next/link";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { HomeHero } from "@/components/platform/HomeHero";
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
  return (
    <div className="platform-page platform-home">
      <StructuredData data={buildMarketplaceJsonLd(businesses)} />
      <PlatformHeader premium />
      <main id="platform-main" tabIndex={-1}>
        <HomeHero sports={activeSports} stats={{ businesses: allBusinesses.length, venues: venueCount, courts: courtCount }} />

        <section className="platform-proof-strip" aria-label="Cómo funciona la plataforma">
          <div className="shell platform-proof-strip__inner">
            <div><span>01</span><p><strong>Explora</strong><small>Encuentra espacios por deporte y horario.</small></p></div>
            <div><span>02</span><p><strong>Compara</strong><small>Revisa complejos, canchas y disponibilidad.</small></p></div>
            <div><span>03</span><p><strong>Reserva</strong><small>Gestiona tu reserva desde el complejo elegido.</small></p></div>
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
            <div><span className="eyebrow">PARA PROPIETARIOS DE CAJAMARCA</span><h2>Administra reservas, precios y operación desde un solo panel.</h2><p>Cada negocio gestiona únicamente su propia operación dentro de Caxas SportCenter.</p></div>
            <Link className="button button--primary" href="/propietario">Ir al panel propietario</Link>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
