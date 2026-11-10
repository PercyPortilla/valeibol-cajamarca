"use client";

import Link from "next/link";
import { useState } from "react";
import { HomeHero } from "@/components/platform/HomeHero";
import { Icon } from "@/components/ui/Icon";
import type { PublicSport } from "@/lib/data/repositories/platformRepository";

type Props = {
  sports: PublicSport[];
  stats: { businesses: number; venues: number; courts: number };
  sportCourtCounts: Record<string, number>;
};

export function HomeSportExperience({ sports, stats, sportCourtCounts }: Props) {
  const [sportSlug, setSportSlug] = useState("");

  function selectSport(nextSportSlug: string, returnToHero = false) {
    setSportSlug(nextSportSlug);
    if (!returnToHero || typeof window === "undefined") return;

    window.requestAnimationFrame(() => {
      const hero = document.getElementById("platform-home-hero");
      if (!hero) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      hero.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  }

  return (
    <>
      <HomeHero
        sports={sports}
        stats={stats}
        sportCourtCounts={sportCourtCounts}
        sportSlug={sportSlug}
        onSportChange={selectSport}
      />

      <section className="platform-proof-strip" aria-label="Cómo funciona la plataforma">
        <div className="shell platform-proof-strip__inner">
          <div><span>01</span><p><strong>Explora</strong><small>Elige el deporte y encuentra tu espacio.</small></p></div>
          <div><span>02</span><p><strong>Conoce</strong><small>Descubre canchas, precios y horarios.</small></p></div>
          <div><span>03</span><p><strong>Coordina</strong><small>Habla por WhatsApp con el complejo.</small></p></div>
        </div>
      </section>

      <section className="platform-section platform-home-sports" id="deportes">
        <div className="shell">
          <div className="platform-section__heading">
            <div><span className="eyebrow">ELIGE TU DISCIPLINA</span><h2>¿Qué quieres jugar?</h2><p>Selecciona un deporte para explorarlo en la vista 3D.</p></div>
            <Link className="text-link" href="/buscar">Ver todas las canchas →</Link>
          </div>
          <div className="platform-sport-grid">
            {sports.map((sport, index) => {
              const courtCount = sportCourtCounts[sport.slug] ?? 0;
              const active = sportSlug === sport.slug;
              return (
                <button
                  className={`platform-sport-card platform-sport-card--${sport.slug}${active ? " is-active" : ""}`}
                  key={sport.id}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Explorar ${sport.name} en la vista interactiva`}
                  onClick={() => selectSport(sport.slug, true)}
                >
                  <span><Icon name={sport.slug === "voley" ? "net" : sport.slug === "basquet" ? "court" : "ball"} size={26} /></span>
                  <div>
                    <span className="platform-sport-card__index">{String(index + 1).padStart(2, "0")} / DEPORTE</span>
                    <strong>{sport.name}</strong>
                    <small>{courtCount > 0 ? `${courtCount} ${courtCount === 1 ? "cancha disponible" : "canchas disponibles"}` : "Sin oferta activa todavía"}</small>
                  </div>
                  <b aria-hidden="true">→</b>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
