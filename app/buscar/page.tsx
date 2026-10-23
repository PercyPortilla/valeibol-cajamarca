import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const sport = first(params.deporte).trim();
  const city = first(params.ciudad).trim();
  const catalog = await getPublicPlatformCatalog({ sportSlug: sport || null, city: city || null });
  const businesses = groupCatalogByBusiness(catalog);

  return (
    <div className="platform-page">
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-hero platform-hero--compact">
          <div className="shell">
            <span className="eyebrow">PLATAFORMA DEPORTIVA</span>
            <h1>Encuentra una cancha para jugar</h1>
            <p>Busca por deporte y ciudad. Cada complejo puede tener varias sedes y canchas dentro de una sola plataforma.</p>
            <PlatformSearchForm sport={sport} city={city} />
          </div>
        </section>
        <section className="platform-section">
          <div className="shell">
            <div className="platform-section__heading"><div><span className="eyebrow">RESULTADOS</span><h2>{businesses.length} {businesses.length === 1 ? "complejo encontrado" : "complejos encontrados"}</h2></div></div>
            <PlatformResults businesses={businesses} />
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
