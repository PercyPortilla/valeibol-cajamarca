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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const sport = first(params.deporte).trim();
  const city = first(params.ciudad).trim();
  const hasFilters = Boolean(sport || city);
  const sportName = sport ? (await getPublicSportBySlug(sport))?.name ?? sport : "";
  const suffix = [sportName, city].filter(Boolean).join(" en ");

  return {
    title: suffix ? `${suffix} | Buscar canchas` : "Buscar canchas",
    description: suffix
      ? `Explora complejos deportivos para ${suffix} y compara sus canchas disponibles.`
      : "Filtra complejos deportivos por ciudad y deporte.",
    robots: hasFilters ? { index: false, follow: true } : { index: true, follow: true },
    ...(hasFilters ? {} : { alternates: { canonical: "/buscar" } }),
  };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sport = first(params.deporte).trim();
  const city = first(params.ciudad).trim();
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
            <span className="platform-live-label"><i aria-hidden="true" /> EXPLORA EL MARKETPLACE</span>
            <h1>Encuentra el lugar correcto para tu próximo partido.</h1>
            <p>Filtra por deporte y ciudad, compara complejos y entra directo a sus canchas disponibles.</p>
            <PlatformSearchForm sport={sport} city={city} />
          </div>
        </section>
        <section className="platform-section">
          <div className="shell">
            <div className="platform-search-summary">
              <div><span className="eyebrow">RESULTADOS</span><h2>{businesses.length} {businesses.length === 1 ? "complejo encontrado" : "complejos encontrados"}</h2></div>
              {(sport || city) ? <div className="platform-active-filters" aria-label="Filtros activos">
                {sport ? <span>Deporte: <strong>{sportName}</strong></span> : null}
                {city ? <span>Ciudad: <strong>{city}</strong></span> : null}
                <Link href="/buscar">Limpiar filtros</Link>
              </div> : <p>Explora toda la oferta disponible en la plataforma.</p>}
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
