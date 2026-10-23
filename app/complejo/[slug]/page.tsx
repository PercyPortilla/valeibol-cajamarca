import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ValeibolLanding } from "@/components/site/ValeibolLanding";
import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/booking";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { buildBusinessDetail } from "@/lib/data/repositories/platformRepository";
import { businessConfig } from "@/config/business";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  if (slug === businessConfig.slug) {
    return {
      title: `${businessConfig.name} | Cancha de vóley en ${businessConfig.city}`,
      description: `Consulta disponibilidad, precios y reserva la cancha de ${businessConfig.name} en ${businessConfig.city}.`,
    };
  }
  return { title: "Complejo deportivo" };
}

export default async function ComplexPage({ params }: { params: Params }) {
  const { slug } = await params;
  if (slug === businessConfig.slug) return <ValeibolLanding />;
  const catalog = await getPublicPlatformCatalog({ businessSlug: slug });
  const business = buildBusinessDetail(catalog, slug);
  if (!business) notFound();

  const courtCount = business.venues.reduce((sum, venue) => sum + venue.courts.length, 0);

  return (
    <div className="platform-page">
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-complex-hero">
          <div className="shell platform-complex-hero__grid">
            <div>
              <span className="eyebrow">COMPLEJO DEPORTIVO</span>
              <h1>{business.name}</h1>
              <p>{business.city ?? "Ciudad por confirmar"}{business.country ? `, ${business.country}` : ""}</p>
            </div>
            <div className="platform-complex-summary">
              <div><strong>{business.venues.length}</strong><span>{business.venues.length === 1 ? "sede" : "sedes"}</span></div>
              <div><strong>{courtCount}</strong><span>{courtCount === 1 ? "cancha" : "canchas"}</span></div>
            </div>
          </div>
        </section>

        <section className="platform-section">
          <div className="shell">
            <div className="platform-section__heading"><div><span className="eyebrow">SEDES Y CANCHAS</span><h2>Elige dónde jugar</h2></div></div>
            <div className="platform-venue-list">
              {business.venues.map((venue) => (
                <section className="platform-venue-card" key={venue.id}>
                  <header>
                    <div><h2>{venue.name}</h2><p>{venue.address ?? venue.city ?? "Ubicación por confirmar"}</p></div>
                    {venue.city ? <Badge tone="neutral">{venue.city}</Badge> : null}
                  </header>
                  <div className="platform-court-grid">
                    {venue.courts.map((court) => (
                      <article className="platform-court-card" key={court.id}>
                        <div className="platform-court-card__head">
                          <Badge tone="info">{court.sportName}</Badge>
                          <span>{court.surface ?? "Superficie por confirmar"}</span>
                        </div>
                        <h3>{court.name}</h3>
                        <p>{court.priceFrom === null ? "Precio por consultar" : `Desde ${formatMoney(court.priceFrom, court.currency)} por hora`}</p>
                        <Link className="button button--primary" href={`/reservar?negocio=${encodeURIComponent(business.slug)}&cancha=${encodeURIComponent(court.id)}`}>Ver disponibilidad</Link>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
