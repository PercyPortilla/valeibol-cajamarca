"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import type { PublicSport } from "@/lib/data/repositories/platformRepository";
import { getHomeSportTheme, isNightSlot } from "@/lib/platform/homeHeroTheme";
import { SportComplexVisual } from "@/components/platform/SportComplexVisual";
import { platformConfig } from "@/config/platform";
import { isCajamarcaLightingTime } from "@/lib/platform/cajamarcaLighting";

type Props = {
  sports: PublicSport[];
  stats: { businesses: number; venues: number; courts: number };
  sportCourtCounts: Record<string, number>;
  sportSlug: string;
  onSportChange: (sportSlug: string) => void;
};

export function HomeHero({ sports, stats, sportCourtCounts, sportSlug, onSportChange }: Props) {
  const [selectedDate, setSelectedDate] = useState("");
  const [minDate, setMinDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("17:00");
  const [sceneNight, setSceneNight] = useState(false);
  const theme = useMemo(() => getHomeSportTheme(sportSlug), [sportSlug]);
  const reservationNeedsLighting = isNightSlot(selectedTime);
  const heroStyle = {
    "--home-sport-accent": theme.accent,
    "--home-sport-accent-soft": theme.accentSoft,
  } as CSSProperties;

  useEffect(() => {
    const syncCajamarcaLighting = () => setSceneNight(isCajamarcaLightingTime(new Date()));
    syncCajamarcaLighting();
    setMinDate(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
    const intervalId = window.setInterval(syncCajamarcaLighting, 15_000);
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncCajamarcaLighting();
    };
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncCajamarcaLighting);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncCajamarcaLighting);
    };
  }, []);

  return (
    <section
      id="platform-home-hero"
      className={`platform-home-hero platform-home-hero--premium${sceneNight ? " is-night" : " is-day"}`}
      data-scene-lighting={sceneNight ? "on" : "off"}
      style={heroStyle}
    >
      <div className="shell platform-home-hero__grid">
        <div className="platform-home-hero__copy">
          <span className="platform-live-label"><i aria-hidden="true" /> CAXAS SPORTCENTER <span className="platform-live-label__city">/ CAJAMARCA, PERÚ</span></span>
          <h1>Encuentra dónde jugar <span>en Cajamarca</span></h1>
          <p>Explora los espacios deportivos de la ciudad, conoce sus precios y coordina tu próximo partido directamente por WhatsApp.</p>
          <strong className="platform-home-hero__tagline">Todo el deporte de Cajamarca, en una sola plataforma.</strong>
          <div className="platform-home-hero__actions">
            <a className="platform-home-hero__discover" href="#deportes">Descubre los deportes <span aria-hidden="true">↗</span></a>
            <Link className="platform-home-hero__discover" href="/experiencia-3d">Explorar complejo en 3D <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <aside className="platform-home-hero__aside" aria-label="Vista interactiva de espacios deportivos">
          <div className="platform-home-hero__scene-meta"><span><i aria-hidden="true" /> COMPLEJO INTERACTIVO</span><small>Explora los escenarios deportivos</small></div>
          <SportComplexVisual
            theme={theme}
            isNight={sceneNight}
            onSportChange={onSportChange}
            courtCounts={sportCourtCounts}
            realModel
          />
        </aside>
        <div className="platform-home-hero__finder">
          <div className="platform-home-hero__finder-heading">
            <div><span>ENCUENTRA TU CANCHA</span><strong>Tu próximo partido empieza aquí.</strong></div>
            <small>Consulta horarios y confirma directamente con el complejo.</small>
          </div>
          <form className="platform-home-search" action="/buscar" method="get">
            <label>
              <span><Icon name={theme.icon} size={14} /> Deporte</span>
              <select name="deporte" value={sportSlug} onChange={(event) => onSportChange(event.target.value)}>
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
              <input name="fecha" type="date" min={minDate || undefined} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>

            <label>
              <span><Icon name="clock" size={14} /> Hora</span>
              <input name="hora" type="time" value={selectedTime} onChange={(event) => setSelectedTime(event.target.value)} />
            </label>

            <button className="button platform-home-search__submit" type="submit">Explorar canchas <span aria-hidden="true">↗</span></button>
          </form>

          <div className={`platform-night-indicator${reservationNeedsLighting ? " is-active" : ""}`} aria-live="polite">
            <Icon name="lighting" size={16} />
            {reservationNeedsLighting ? "Horario nocturno: consulta la iluminación de la cancha." : "Los horarios se confirman directamente con cada negocio."}
          </div>
        </div>
      </div>

      <div className="shell platform-home-hero__footer">
        <div className="platform-home-hero__sports" aria-label="Enfocar complejo por deporte">
          {sports.map((sport) => {
            const sportTheme = getHomeSportTheme(sport.slug);
            const active = Object.is(sportSlug, sport.slug);
            return (
              <button
                className={`platform-home-hero__sport${active ? " is-active" : ""}`}
                key={sport.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSportChange(sport.slug)}
              >
                <Icon name={sportTheme.icon} size={18} />
                <span>{sport.name}</span>
              </button>
            );
          })}
        </div>

        <div className="platform-market-stats" aria-label="Inventario disponible">
          <div><strong>{stats.businesses}</strong><span>complejos</span></div>
          <div><strong>{stats.venues}</strong><span>sedes</span></div>
          <div><strong>{stats.courts}</strong><span>canchas</span></div>
        </div>
      </div>
    </section>
  );
}

