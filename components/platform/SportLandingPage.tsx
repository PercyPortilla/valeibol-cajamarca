import { PlatformFooter } from "@/components/platform/PlatformFooter";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { PlatformResults } from "@/components/platform/PlatformResults";
import { PlatformSearchForm } from "@/components/platform/PlatformSearchForm";
import { SportLandingVisual } from "@/components/platform/SportLandingVisual";
import type { SportSlug } from "@/config/sports";
import { getSportLandingBusinesses, getSportLandingDefinition } from "@/lib/platform/sportLanding";
import { getPublicSportBySlug } from "@/lib/data/platformService";
import { getHomeSportTheme } from "@/lib/platform/homeHeroTheme";
import { platformConfig } from "@/config/platform";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

export async function SportLandingPage({ sportSlug }: { sportSlug: SportSlug }) {
  const sport = await getPublicSportBySlug(sportSlug);
  if (!sport) notFound();
  const definition = getSportLandingDefinition(sportSlug, sport.name);
  const businesses = await getSportLandingBusinesses(sportSlug);
  const theme = getHomeSportTheme(sportSlug);
  const pageStyle = {
    "--home-sport-accent": theme.accent,
    "--home-sport-accent-soft": theme.accentSoft,
  } as CSSProperties;

  return (
    <div className={`platform-page platform-sport-landing platform-sport-landing--${sportSlug}`} style={pageStyle}>
      <PlatformHeader premium />
      <main id="platform-main" tabIndex={-1}>
        <section className="platform-sport-landing__hero">
          <div className="shell platform-sport-landing__hero-grid">
            <div className="platform-sport-landing__copy">
              <span className="platform-sport-landing__eyebrow"><i aria-hidden="true" /> {definition.eyebrow}</span>
              <h1>{definition.title}</h1>
              <p>{definition.description}</p>
              <div className="platform-sport-landing__coverage">
                <strong>{platformConfig.regionLabel}</strong>
                <span>Cobertura actual</span>
              </div>
            </div>
            <div className="platform-sport-landing__visual">
              <SportLandingVisual sportSlug={sportSlug} />
            </div>
            <div className="platform-sport-landing__search">
              <PlatformSearchForm sport={sportSlug} />
            </div>
          </div>
        </section>
        <section className="platform-section platform-sport-landing__results">
          <div className="shell">
            <div className="platform-section__heading platform-sport-landing__heading">
              <div>
                <span className="eyebrow">ESPACIOS DISPONIBLES</span>
                <h2>{sport.name} en Cajamarca</h2>
              </div>
              <span className="platform-sport-landing__count">{businesses.length} {businesses.length === 1 ? "complejo" : "complejos"}</span>
            </div>
            <PlatformResults businesses={businesses} premium />
          </div>
        </section>
      </main>
      <PlatformFooter />
    </div>
  );
}
