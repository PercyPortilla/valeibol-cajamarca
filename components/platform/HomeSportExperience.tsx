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
          <div><span>01</span><p><strong>Explora</strong><small>Encuentra espacios por deporte y horario.</small></p></div>
          <div><span>02</span><p><strong>Compara</strong><small>Revisa complejos, canchas y disponibilidad.</small></p></div>
          <div><span>03</span><p><strong>Reserva</strong><small>Gestiona tu reserva desde el complejo elegido.</small></p></div>
        </div>
      </section>

      <section className="platform-section platform-home-sports" id="deportes">
        <div className="shell">
          <div className="platform-section__heading">
            <div><span className="eyebrow">DEPORTES</span><h2>¿Qué quieres jugar?</h2></div>
            <Link className="text-link" href="/buscar">Ver todas las canchas →</Link>
          </div>
          <div className="platform-sport-grid">
            {sports.map((sport) => {
              const courtCount = sportCourtCounts[sport.slug] ?? 0;
              const active = sportSlug === sport.slug;
              return (
                <button
                  className={`platform-sport-card platform-sport-card--${sport.slug}${active ? " is-active" : ""}`}
                  key={sport.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectSport(sport.slug, true)}
                >
                  <span><Icon name={sport.slug === "voley" ? "net" : sport.slug === "basquet" ? "court" : "ball"} size={22} /></span>
                  <div>
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
