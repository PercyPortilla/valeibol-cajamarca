import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import type { SportSlug } from "@/config/sports";
import { getSportLandingBusinesses, getSportLandingDefinition } from "@/lib/platform/sportLanding";
import { getPublicSportBySlug } from "@/lib/data/platformService";
import { notFound } from "next/navigation";

export async function SportLandingPage({ sportSlug }: { sportSlug: SportSlug }) {
  const sport = await getPublicSportBySlug(sportSlug);
  if (!sport) notFound();
  const definition = getSportLandingDefinition(sportSlug, sport.name);
  const businesses = await getSportLandingBusinesses(sportSlug);

  return (
    <div className="platform-page">
      <PlatformHeader />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-hero platform-hero--sport">
          <div className="shell">
            <span className="eyebrow">{definition.eyebrow}</span>
            <h1>{definition.title}</h1>
            <p>{definition.description}</p>
            <PlatformSearchForm sport={sportSlug} />
          </div>
        </section>
        <section className="platform-section">
          <div className="shell"><PlatformResults businesses={businesses} /></div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
