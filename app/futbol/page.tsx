import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import { getPublicPlatformCatalog } from "@/lib/data/platformService";
import { groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";

export default async function FootballPage() {
  const businesses = groupCatalogByBusiness(await getPublicPlatformCatalog({ sportSlug: "futbol" }));
  return (
    <div className="platform-page">
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-hero platform-hero--sport"><div className="shell"><span className="eyebrow">FÚTBOL</span><h1>Canchas de fútbol</h1><p>La arquitectura ya está preparada para incorporar campos de fútbol y futsal de múltiples negocios.</p><PlatformSearchForm sport="futbol" /></div></section>
        <section className="platform-section"><div className="shell"><PlatformResults businesses={businesses} /></div></section>
      </main>
      <PlatformFooter />
    </div>
  );
}
