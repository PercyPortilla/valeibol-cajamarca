import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";

export default async function VolleyballPage() {
  const businesses = groupCatalogByBusiness(await getPublicPlatformCatalog({ sportSlug: "voley" }));
  return (
    <div className="platform-page">
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-hero platform-hero--sport"><div className="shell"><span className="eyebrow">VÓLEY</span><h1>Canchas de vóley</h1><p>Explora complejos que ofrecen vóley y compara sedes, canchas y precios disponibles.</p><PlatformSearchForm sport="voley" /></div></section>
        <section className="platform-section"><div className="shell"><PlatformResults businesses={businesses} /></div></section>
      </main>
      <PlatformFooter />
    </div>
  );
}
