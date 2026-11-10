import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import { PlatformLocationExplorer } from "@/components/platform/PlatformLocationExplorer";
import { getPublicPlatformCatalogResult, getPublicSportBySlug } from "@/lib/data/platformService";
import { buildPlatformLocationPoints, groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";
import Link from "next/link";
import type { Metadata } from "next";
import { StructuredData } from "@/components/platform/StructuredData";
import { buildBreadcrumbJsonLd } from "@/lib/platform/seo";
import { platformConfig } from "@/config/platform";
import { normalizeSearchDate, normalizeSearchTime } from "@/lib/platform/searchFilters";
import { getHomeSportTheme, isNightSlot } from "@/lib/platform/homeHeroTheme";
import { SportLandingVisual } from "@/components/platform/SportLandingVisual";
import type { CSSProperties } from "react";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = await searchParams;
  const sport = first(params.deporte).trim();
  const date = normalizeSearchDate(first(params.fecha));
  const time = normalizeSearchTime(first(params.hora));
  const city = platformConfig.city;
  const hasFilters = Boolean(sport || date || time);
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
  const date = normalizeSearchDate(first(params.fecha));
  const time = normalizeSearchTime(first(params.hora));
  const city = platformConfig.city;
  const sportName = sport ? (await getPublicSportBySlug(sport))?.name ?? sport : "";
  const catalogResult = await getPublicPlatformCatalogResult({ sportSlug: sport || null, city: city || null });
  const { catalog } = catalogResult;
  const businesses = groupCatalogByBusiness(catalog);
  const locations = buildPlatformLocationPoints(catalog);
  const hasFilters = Boolean(sport || date || time);
  const lightingRequired = Boolean(time && isNightSlot(time));
  const theme = getHomeSportTheme(sport);
  const pageStyle = {
    "--home-sport-accent": theme.accent,
    "--home-sport-accent-soft": theme.accentSoft,
  } as CSSProperties;

  return (
    <div className="platform-page platform-search-page" style={pageStyle}>
      {!hasFilters ? <StructuredData data={buildBreadcrumbJsonLd([{ name: "Inicio", pathname: "/" }, { name: "Buscar canchas", pathname: "/buscar" }])} /> : null}
      <PlatformHeader premium />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-search-page__hero">
          <div className="shell platform-search-page__hero-grid">
            <div className="platform-search-page__copy">
              <nav className="platform-breadcrumbs" aria-label="Migas de pan"><ol><li><Link href="/">Inicio</Link></li><li aria-hidden="true">/</li><li aria-current="page">Buscar canchas</li></ol></nav>
              <span className="platform-search-page__eyebrow"><i aria-hidden="true" /> CAJAMARCA · COBERTURA ACTUAL</span>
              <h1>{sportName ? `${sportName} en Cajamarca` : "Encuentra dónde jugar en Cajamarca"}</h1>
              <p>Busca complejos por deporte y revisa sus canchas. La fecha y hora son orientativas: confirma disponibilidad y precios directamente con cada negocio por WhatsApp.</p>
              <div className="platform-search-page__context">
                <span>{theme.label}</span>
                <small>{lightingRequired ? "Horario nocturno: confirma iluminación con el negocio" : "Exploración deportiva en Cajamarca"}</small>
              </div>
            </div>
            <div className="platform-search-page__visual">
              <SportLandingVisual sportSlug={sport} />
            </div>
            <div className="platform-search-page__form">
              <PlatformSearchForm sport={sport} city={city} date={date} time={time} />
            </div>
          </div>
        </section>
        <section className="platform-section platform-search-page__results">
          <div className="shell">
            <div className="platform-search-summary platform-search-page__summary">
              <div><span className="eyebrow">RESULTADOS</span><h2>{catalogResult.failed ? "Catálogo temporalmente no disponible" : `${businesses.length} ${businesses.length === 1 ? "complejo encontrado" : "complejos encontrados"}`}</h2></div>
              <div className="platform-active-filters" aria-label="Filtros activos">
                {sport ? <span>Deporte: <strong>{sportName}</strong></span> : null}
                <span>Ciudad: <strong>{city}</strong></span>
                {date ? <span>Fecha de consulta: <strong>{date}</strong></span> : null}
                {time ? <span>Hora de consulta: <strong>{time}</strong></span> : null}
                {sport ? <Link href="/buscar">Limpiar deporte</Link> : null}
              </div>
            </div>
            {(date || time) ? <p className="platform-search-page__timing-note" role="status">La fecha y hora todavía no filtran la disponibilidad de cada complejo. Consulta el horario específico dentro de cada cancha y confírmalo por WhatsApp.</p> : null}
            {!catalogResult.failed ? <PlatformLocationExplorer points={locations} /> : null}
            <PlatformResults businesses={businesses} premium lightingRequired={lightingRequired} loadFailed={catalogResult.failed} filtered={Boolean(sport)} retryHref="/buscar" />
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
