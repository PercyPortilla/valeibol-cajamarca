"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { PlatformLocationPoint } from "@/lib/data/repositories/platformRepository";
import { googleMapsEmbedHref, googleMapsSearchHref } from "@/lib/platform/maps";
import { complexRoute } from "@/lib/platform/routes";

export function PlatformLocationExplorer({ points }: { points: PlatformLocationPoint[] }) {
  const mappable = useMemo(() => points.filter((point) => googleMapsEmbedHref(point)), [points]);
  const [selectedId, setSelectedId] = useState(mappable[0]?.venueId ?? "");
  const selected = mappable.find((point) => point.venueId === selectedId) ?? mappable[0] ?? null;
  const embedHref = selected ? googleMapsEmbedHref(selected) : null;
  const mapsHref = selected ? googleMapsSearchHref(selected) : null;

  if (!selected || !embedHref) return null;

  return (
    <section className="platform-location-explorer" aria-labelledby="platform-map-title">
      <div className="platform-location-explorer__heading">
        <div>
          <span className="eyebrow">UBICACIONES</span>
          <h2 id="platform-map-title">Explora dónde jugar</h2>
          <p>{mappable.length} {mappable.length === 1 ? "sede disponible" : "sedes disponibles"} en el mapa.</p>
        </div>
        {mapsHref ? <a className="button button--secondary" href={mapsHref} target="_blank" rel="noreferrer">Abrir en Maps <span aria-hidden="true">↗</span></a> : null}
      </div>

      <div className="platform-location-explorer__layout">
        <div className="platform-location-list" aria-label="Sedes encontradas">
          {mappable.map((point, index) => {
            const active = point.venueId === selected.venueId;
            return (
              <button
                key={point.venueId}
                className={active ? "platform-location-option is-active" : "platform-location-option"}
                type="button"
                onClick={() => setSelectedId(point.venueId)}
                aria-pressed={active}
              >
                <span className="platform-location-option__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="platform-location-option__copy">
                  <strong>{point.businessName}</strong>
                  <small>{point.venueName}</small>
                  <em><Icon name="location" size={14} /> {point.address ?? point.city ?? "Ubicación por confirmar"}</em>
                  <span>{point.sports.join(" · ") || "Deportes"}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="platform-map-frame">
          <iframe
            key={selected.venueId}
            src={embedHref}
            title={`Mapa de ${selected.businessName}, ${selected.venueName}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            allowFullScreen
          />
          <div className="platform-map-frame__card">
            <div><span>SEDE SELECCIONADA</span><strong>{selected.businessName}</strong><small>{selected.address ?? selected.city ?? "Ubicación por confirmar"}</small></div>
            <Link className="button button--primary" href={complexRoute(selected.businessSlug)}>Ver complejo <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
