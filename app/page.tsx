import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { HomeSportExperience } from "@/components/platform/HomeSportExperience";
import { getPublicPlatformCatalogResult, getPublicSports } from "@/lib/data/platformService";
import { groupCatalogByBusiness } from "@/lib/data/repositories/platformRepository";
import { StructuredData } from "@/components/platform/StructuredData";
import { buildMarketplaceJsonLd } from "@/lib/platform/seo";
import type { Metadata } from "next";
import Link from "next/link";
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
  const [catalogResult, activeSports] = await Promise.all([getPublicPlatformCatalogResult(), getPublicSports()]);
  const { catalog } = catalogResult;
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
  const sportCourtCountRecord = Object.fromEntries(
    [...sportCourtCounts.entries()].map(([slug, courtIds]) => [slug, courtIds.size]),
  );
  return (
    <div className="platform-page platform-home">
      <StructuredData data={buildMarketplaceJsonLd(businesses)} />
      <PlatformHeader premium />
      <main id="platform-main" tabIndex={-1}>
        <HomeSportExperience
          sports={activeSports}
          stats={{ businesses: allBusinesses.length, venues: venueCount, courts: courtCount }}
          sportCourtCounts={sportCourtCountRecord}
        />

        <section className="platform-section platform-home-featured" id="complejos">
          <div className="shell">
            <div className="platform-section__heading">
              <div><span className="eyebrow">CANCHAS CON IDENTIDAD LOCAL</span><h2>Complejos disponibles</h2><p>Explora los espacios de Cajamarca, conoce sus instalaciones y contacta al negocio que elijas.</p></div>
            </div>
            <PlatformResults businesses={businesses} premium loadFailed={catalogResult.failed} retryHref="/" />
            {allBusinesses.length > businesses.length ? (
              <Link className="platform-home-featured__all" href="/buscar">Explorar los {allBusinesses.length} complejos <span aria-hidden="true">↗</span></Link>
            ) : null}
          </div>
        </section>

      </main>
      <PlatformFooter />
    </div>
  );
}
