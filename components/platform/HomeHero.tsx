"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import type { PublicSport } from "@/lib/data/repositories/platformRepository";
import { getHomeSportTheme, isNightSlot } from "@/lib/platform/homeHeroTheme";
import { SportComplexVisual } from "@/components/platform/SportComplexVisual";
import { platformConfig } from "@/config/platform";

type Props = {
  sports: PublicSport[];
  stats: { businesses: number; venues: number; courts: number };
};

export function HomeHero({ sports, stats }: Props) {
  const [sportSlug, setSportSlug] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("17:00");
  const theme = useMemo(() => getHomeSportTheme(sportSlug), [sportSlug]);
  const night = isNightSlot(selectedTime);
  const heroStyle = {
    "--home-sport-accent": theme.accent,
    "--home-sport-accent-soft": theme.accentSoft,
  } as CSSProperties;

  return (
    <section className={`platform-home-hero platform-home-hero--premium${night ? " is-night" : " is-day"}`} style={heroStyle}>
      <div className="shell platform-home-hero__grid">
        <div className="platform-home-hero__copy">
          <span className="platform-live-label"><i aria-hidden="true" /> CAXAS SPORTCENTER</span>
          <h1>Encuentra dónde jugar <span>en Cajamarca</span></h1>
          <p>Explora canchas, coliseos y espacios deportivos. Compara horarios, disponibilidad y elige el lugar ideal para tu próximo partido.</p>
          <strong className="platform-home-hero__tagline">Todo el deporte de Cajamarca, en una sola plataforma.</strong>

          <form className="platform-home-search" action="/buscar" method="get">
            <label>
              <span><Icon name={theme.icon} size={14} /> Deporte</span>
              <select name="deporte" value={sportSlug} onChange={(event) => setSportSlug(event.target.value)}>
                <option value="">Multi-deporte</option>
                {sports.map((sport) => <option key={sport.id} value={sport.slug}>{sport.name}</option>)}
              </select>
            </label>

            <div className="platform-home-search__coverage" aria-label={`Cobertura actual: ${platformConfig.regionLabel}`}>
              <strong><Icon name="location" size={15} /> {platformConfig.regionLabel}</strong>
              <small>Cobertura actual</small>
              <input type="hidden" name="ciudad" value={platformConfig.city} />
            </div>

            <label>
              <span><Icon name="calendar" size={14} /> Fecha</span>
              <input name="fecha" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>

            <label>
              <span><Icon name="clock" size={14} /> Hora</span>
              <input name="hora" type="time" value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} />
            </label>

            <button className="button platform-home-search__submit" type="submit">Explorar espacios <span aria-hidden="true">→</span></button>
          </form>

          <div className={`platform-night-indicator${night ? " is-active" : ""}`} aria-live="polite">
            <Icon name="lighting" size={16} />
            {night ? "Con iluminación" : "Iluminación no requerida para este horario"}
          </div>
        </div>

        <aside className="platform-home-hero__aside" aria-label="Vista y resumen del marketplace">
          <SportComplexVisual theme={theme} isNight={night} />
          <div className="platform-market-stats" aria-label="Inventario disponible">
            <div><strong>{stats.businesses}</strong><span>complejos</span></div>
            <div><strong>{stats.venues}</strong><span>sedes</span></div>
            <div><strong>{stats.courts}</strong><span>canchas</span></div>
          </div>
        </aside>
      </div>
    </section>
  );
}

