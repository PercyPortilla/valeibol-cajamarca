import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import { PlatformLocationExplorer } from "@/components/platform/PlatformLocationExplorer";
import { getPublicPlatformCatalog, getPublicSportBySlug } from "@/lib/data/platformService";
import { buildPlatformLocationPoints, groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";
import Link from "next/link";
import type { Metadata } from "next";
import { StructuredData } from "@/components/platform/StructuredData";
import { buildBreadcrumbJsonLd } from "@/lib/platform/seo";
import { platformConfig } from "@/config/platform";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const sport = first(params.deporte).trim();
  const city = platformConfig.city;
  const hasFilters = Boolean(sport);
  const sportName = sport ? (await getPublicSportBySlug(sport))?.name ?? sport : "";
  const title = sportName ? `${sportName} en ${city} | Buscar canchas` : `Buscar canchas en ${city}`;

  return {
    title,
    description: sportName
      ? `Explora complejos deportivos de ${sportName} en ${city} y compara sus canchas disponibles.`
      : `Explora complejos deportivos de ${platformConfig.city} por deporte.`,
    robots: hasFilters ? { index: false, follow: true } : { index: true, follow: true },
    ...(hasFilters ? {} : { alternates: { canonical: "/buscar" } }),
  };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sport = first(params.deporte).trim();
  const city = platformConfig.city;
  const sportName = sport ? (await getPublicSportBySlug(sport))?.name ?? sport : "";
  const catalog = await getPublicPlatformCatalog({ sportSlug: sport || null, city: city || null });
  const businesses = groupCatalogByBusiness(catalog);
  const locations = buildPlatformLocationPoints(catalog);
  const hasFilters = Boolean(sport || city);

  return (
    <div className="platform-page">
      {!hasFilters ? <StructuredData data={buildBreadcrumbJsonLd([{ name: "Inicio", pathname: "/" }, { name: "Buscar canchas", pathname: "/buscar" }])} /> : null}
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-hero platform-hero--compact">
          <div className="shell">
            <nav className="platform-breadcrumbs" aria-label="Migas de pan"><ol><li><Link href="/">Inicio</Link></li><li aria-hidden="true">/</li><li aria-current="page">Buscar canchas</li></ol></nav>
            <span className="platform-live-label"><i aria-hidden="true" /> CAJAMARCA</span>
            <h1>Encuentra el lugar correcto para tu próximo partido en Cajamarca.</h1>
            <p>Filtra por deporte, compara complejos de Cajamarca y entra directo a sus canchas disponibles.</p>
            <PlatformSearchForm sport={sport} city={city} />
          </div>
        </section>
        <section className="platform-section">
          <div className="shell">
            <div className="platform-search-summary">
              <div><span className="eyebrow">RESULTADOS</span><h2>{businesses.length} {businesses.length === 1 ? "complejo encontrado" : "complejos encontrados"}</h2></div>
              <div className="platform-active-filters" aria-label="Filtros activos">
                {sport ? <span>Deporte: <strong>{sportName}</strong></span> : null}
                <span>Ciudad: <strong>{city}</strong></span>
                {sport ? <Link href="/buscar">Limpiar deporte</Link> : null}
              </div>
            </div>
            <PlatformLocationExplorer points={locations} />
            <PlatformResults businesses={businesses} />
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
