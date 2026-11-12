"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Sport = { slug: string; name: string };
type Court = {
  id: string;
  name: string;
  sports: Sport[];
  bookable: boolean;
  priceText: string | null;
};

type Props = {
  businessName: string;
  businessSlug: string;
  city: string | null;
  coverImageUrl: string | null;
  coverAltText: string;
  logoUrl: string | null;
  locationName: string | null;
  address: string | null;
  mapHref: string | null;
  whatsappHref: string | null;
  courts: Court[];
};

function PitchArt({ sport }: { sport: "futbol" | "voley" }) {
  return (
    <div className="ss-cinema-pitch__board" key={sport} aria-label={`Ilustración conceptual de cancha de ${sport === "futbol" ? "fútbol" : "vóley"}`} role="img">
      <div className="ss-cinema-pitch__turf">
        <svg viewBox="0 0 660 400" aria-hidden="true" focusable="false" className="ss-cinema-pitch__lines">
          <rect x="35" y="30" width="590" height="340" rx="2" fill="none" stroke="currentColor" strokeWidth="4" />
          {sport === "futbol" ? <>
            <path d="M330 30V370" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="330" cy="200" r="73" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="330" cy="200" r="5" fill="currentColor" />
            <rect x="35" y="104" width="96" height="192" fill="none" stroke="currentColor" strokeWidth="4" />
            <rect x="529" y="104" width="96" height="192" fill="none" stroke="currentColor" strokeWidth="4" />
            <rect x="35" y="148" width="34" height="104" fill="none" stroke="currentColor" strokeWidth="4" />
            <rect x="591" y="148" width="34" height="104" fill="none" stroke="currentColor" strokeWidth="4" />
            <path d="M131 143A73 73 0 0 1 131 257M529 143A73 73 0 0 0 529 257" fill="none" stroke="currentColor" strokeWidth="4" />
          </> : <>
            <path d="M330 30V370M230 30V370M430 30V370" fill="none" stroke="currentColor" strokeWidth="4" />
            <path d="M330 20V380" fill="none" stroke="currentColor" strokeWidth="11" strokeDasharray="7 5" opacity=".55" />
            <circle cx="330" cy="30" r="7" fill="currentColor" />
            <circle cx="330" cy="370" r="7" fill="currentColor" />
          </>}
        </svg>
      </div>
      <span className="ss-cinema-pitch__north" aria-hidden="true">SS / SPORT</span>
    </div>
  );
}

export function SanSebastianCinematic({
  businessName, businessSlug, city, coverImageUrl, coverAltText, logoUrl,
  locationName, address, mapHref, whatsappHref, courts,
}: Props) {
  const [sport, setSport] = useState<"futbol" | "voley">("futbol");
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCourt = courts[activeIndex] ?? courts[0];
  const reservationRoot = `/reservar?negocio=${encodeURIComponent(businessSlug)}`;
  const reserveHref = activeCourt ? `${reservationRoot}&cancha=${encodeURIComponent(activeCourt.id)}` : reservationRoot;
  const sportChoices = useMemo(() => [
    { slug: "futbol" as const, label: "Fútbol" },
    { slug: "voley" as const, label: "Vóley" },
  ], []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ss-cinema-world");
    if (!root || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sections = root.querySelectorAll<HTMLElement>("[data-ss-reveal]");
    if (!sections.length || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("ss-is-visible");
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: .12, rootMargin: "0px 0px -35px 0px" });
    sections.forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight * .91) element.classList.add("ss-is-visible");
      else observer.observe(element);
    });
    root.classList.add("ss-motion-ready");
    return () => { observer.disconnect(); root.classList.remove("ss-motion-ready"); };
  }, []);

  const chooseRelative = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + courts.length) % courts.length);
  };

  return <div className="ss-cinema-experience">
    <section className="ss-cinema-hero" aria-labelledby="ss-cinema-title">
      {coverImageUrl ? <Image className="ss-cinema-hero__photo" src={coverImageUrl} alt={coverAltText} fill sizes="100vw" priority /> : null}
      <div className="ss-cinema-hero__lighting" aria-hidden="true" />
      <div className="ss-cinema-hero__touchline" aria-hidden="true" />
      <div className="shell ss-cinema-hero__content">
        <div className="ss-cinema-hero__copy">
          <div className="ss-cinema-hero__eyeline"><span className="ss-cinema-hero__live-dot" /> {businessName} <span className="ss-cinema-hero__eyeline-separator" /> {city ?? "Cajamarca"}</div>
          <h1 id="ss-cinema-title"><span>El partido</span><span>empieza <em>aquí.</em></span></h1>
          <p>Dos campos. Fútbol y vóley. Un lugar para vivir cada jugada.</p>
          <div className="ss-cinema-hero__actions">
            <a className="ss-cinema-button ss-cinema-button--primary" href="#canchas">Explorar los campos <span aria-hidden="true">↗</span></a>
            <Link className="ss-cinema-button ss-cinema-button--outline" href={reservationRoot}>Consultar horarios <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <div className="ss-cinema-hero__emblem" aria-hidden="true">
          <span className="ss-cinema-hero__emblem-frame"><span className="ss-cinema-hero__emblem-center" /></span>
          <span className="ss-cinema-hero__emblem-copy">CAMPO / PASIÓN / JUEGO</span>
        </div>
        <a href="#experiencia" className="ss-cinema-hero__scroll">Desliza para descubrir <span aria-hidden="true">↓</span></a>
        <span className="ss-cinema-hero__edition" aria-hidden="true">SAN SEBASTIÁN — CAJAMARCA</span>
      </div>
    </section>

    <section className="ss-cinema-sports" id="experiencia" aria-labelledby="ss-cinema-sports-title">
      <div className="shell ss-cinema-sports__grid">
        <div className="ss-cinema-sports__copy" data-ss-reveal>
          <span className="ss-cinema-overline">EL TERRENO ES EL PROTAGONISTA</span>
          <h2 id="ss-cinema-sports-title">Dos deportes.<br /><em>La misma pasión.</em></h2>
          <p>Una cancha que se transforma con el juego. Cambia entre fútbol y vóley para descubrir las dos maneras de disfrutar nuestros campos.</p>
          <div className="ss-cinema-sports__switch" role="group" aria-label="Ver deporte en la representación gráfica">
            {sportChoices.map((option) => <button key={option.slug} type="button"
              className={sport === option.slug ? "is-selected" : ""}
              aria-pressed={sport === option.slug} onClick={() => setSport(option.slug)}>{option.label}</button>)}
          </div>
          <small>Representación gráfica del deporte, no un plano de dimensiones reales.</small>
        </div>
        <div className="ss-cinema-sports__visual" data-ss-reveal>
          <div className="ss-cinema-sports__glow" aria-hidden="true" />
          <PitchArt sport={sport} />
          <span className="ss-cinema-sports__index">{sport === "futbol" ? "01 / FÚTBOL" : "02 / VÓLEY"}</span>
        </div>
      </div>
    </section>

    <section className="ss-cinema-fields" id="canchas" aria-labelledby="ss-cinema-fields-title">
      <div className="shell ss-cinema-fields__inner">
        <div className="ss-cinema-fields__heading" data-ss-reveal>
          <span className="ss-cinema-overline">SELECCIONA TU ESPACIO</span>
          <h2 id="ss-cinema-fields-title">Elige tu <em>campo.</em></h2>
          <p>Dos espacios físicos, ambos para fútbol y vóley. Conoce cada campo y consulta directamente su disponibilidad.</p>
        </div>
        <div className="ss-cinema-fields__stage" data-ss-reveal>
          <div className="ss-cinema-fields__deck" role="group" aria-label="Seleccionar Campo 1 o Campo 2">
            {courts.map((court, index) => {
              const selected = index === activeIndex;
              const relative = selected ? "is-front" : index < activeIndex ? "is-before" : "is-after";
              return <button className={`ss-cinema-field-card ${relative}`} type="button" key={court.id}
                aria-pressed={selected} onClick={() => setActiveIndex(index)} aria-label={`Mostrar ${court.name}`}>
                <span className="ss-cinema-field-card__art">
                  {index === 0 && coverImageUrl ? <Image src={coverImageUrl} fill sizes="(max-width: 720px) 85vw, 520px" alt="" /> : <span className="ss-cinema-field-card__synthetic" aria-hidden="true"><span /></span>}
                  <span className="ss-cinema-field-card__shade" />
                  <span className="ss-cinema-field-card__number">{String(index + 1).padStart(2, "0")} <small>/ {String(courts.length).padStart(2, "0")}</small></span>
                  <span className="ss-cinema-field-card__brand">{index === 0 ? "SAN SEBASTIÁN" : "VISUAL CONCEPTUAL"}</span>
                  <span className="ss-cinema-field-card__title">{court.name}</span>
                  <span className="ss-cinema-field-card__sports">FÚTBOL <span aria-hidden="true">•</span> VÓLEY</span>
                  <span className="ss-cinema-field-card__edge" aria-hidden="true" />
                </span>
              </button>;
            })}
          </div>
          <div className="ss-cinema-fields__controls">
            <button type="button" onClick={() => chooseRelative(-1)} aria-label="Campo anterior" disabled={courts.length < 2}>←</button>
            <span>{String(activeIndex + 1).padStart(2, "0")} <i /> {String(courts.length).padStart(2, "0")}</span>
            <button type="button" onClick={() => chooseRelative(1)} aria-label="Campo siguiente" disabled={courts.length < 2}>→</button>
          </div>
        </div>
        {activeCourt ? <div className="ss-cinema-fields__detail" data-ss-reveal aria-live="polite">
          <div>
            <span className="ss-cinema-fields__status">{activeCourt.bookable ? "AGENDA DISPONIBLE PARA CONSULTAR" : "HORARIOS POR CONFIRMAR"}</span>
            <h3>{activeCourt.name}</h3>
            <p>{activeCourt.bookable ? "Elige el deporte, el día y cuántas horas deseas jugar. El negocio confirma la disponibilidad por WhatsApp." : "Este campo también admite fútbol y vóley. La pizarra está lista para explorar días; sus horarios y tarifas aún deben ser publicados por el propietario."}</p>
            {activeCourt.priceText && activeCourt.bookable ? <span className="ss-cinema-fields__price">{activeCourt.priceText}</span> : null}
          </div>
          <Link className="ss-cinema-button ss-cinema-button--primary" href={reserveHref}>{activeCourt.bookable ? "Ver horarios del campo" : "Explorar su pizarra"} <span aria-hidden="true">↗</span></Link>
        </div> : null}
      </div>
    </section>

    <section className="ss-cinema-visit" id="contacto" aria-labelledby="ss-cinema-visit-title">
      <div className="shell ss-cinema-visit__grid" data-ss-reveal>
        <div>
          <span className="ss-cinema-overline">EL ENCUENTRO ES EN SAN SEBASTIÁN</span>
          <h2 id="ss-cinema-visit-title">La próxima jugada<br />nos encuentra <em>aquí.</em></h2>
          <p>{locationName ? `${locationName} · ` : ""}{address ?? city ?? "Cajamarca"}</p>
          <div className="ss-cinema-visit__actions">
            {mapHref ? <a className="ss-cinema-button ss-cinema-button--dark" href={mapHref} target="_blank" rel="noopener noreferrer">Cómo llegar <span aria-hidden="true">↗</span></a> : null}
            {whatsappHref ? <a className="ss-cinema-button ss-cinema-button--line" href={whatsappHref} target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp <span aria-hidden="true">↗</span></a> : null}
          </div>
        </div>
        <div className="ss-cinema-visit__seal" aria-hidden="true">
          {logoUrl ? <Image src={logoUrl} alt="" width={145} height={145} /> : <span>SS</span>}
          <small>DONDE SE VIVE EL DEPORTE</small>
        </div>
      </div>
    </section>
  </div>;
}
