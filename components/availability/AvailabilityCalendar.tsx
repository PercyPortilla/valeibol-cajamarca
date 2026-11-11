"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  addDays,
  businessTodayDateKey,
  formatTimeRange,
  formatWeekRange,
  startOfWeekMonday,
  type AvailabilitySlot,
  type AvailabilityWeekSnapshot,
  type SlotStatus,
} from "@/lib/availability";
import { isPastLocalStart } from "@/lib/booking";
import { createPublicAvailabilityRepository } from "@/lib/data/availabilityService";
import { subscribeToPublicAvailabilityChanges } from "@/lib/data/availabilityRealtime";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { buildWhatsAppChatHref } from "@/lib/whatsapp/links";

type DemoState = "ready" | "loading" | "empty" | "error";
type LoadState = "idle" | "loading" | "ready" | "error";

type AvailabilityCalendarProps = {
  businessSlug: string;
  businessName: string;
  businessTimezone: string;
  initialCourtId: string | null;
  courtSports: Record<string, { slug: string; name: string }[]>;
  initialSportSlug?: string;
  contactPhoneE164: string | null;
};

const STATUS_LABELS: Record<SlotStatus, string> = {
  available: "Disponible",
  occupied: "Ocupado",
  unavailable: "No disponible",
};

function readDemoState(): DemoState {
  if (typeof window === "undefined") return "ready";
  const state = new URLSearchParams(window.location.search).get("demoState");
  return state === "loading" || state === "empty" || state === "error" ? state : "ready";
}

function Slot({
  slot,
  compact = false,
  whatsappHref,
}: {
  slot: AvailabilitySlot;
  compact?: boolean;
  whatsappHref: string | null;
}) {
  const effectiveStatus: SlotStatus = slot.status;
  return (
    <div className={`time-slot time-slot--${effectiveStatus} ${compact ? "time-slot--compact" : ""}`}>
      <div className="time-slot__main">
        <span className="time-slot__time">{formatTimeRange(slot.start, slot.end)}</span>
        <span className="time-slot__status">
          <i className={`status-dot status-dot--${effectiveStatus}`} aria-hidden="true" />
          {STATUS_LABELS[effectiveStatus]}
        </span>
      </div>
      {whatsappHref ? (
        <a
          className="slot-cta"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Consultar por WhatsApp el horario del ${slot.date}, ${slot.start} a ${slot.end}`}
        >
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}

function DataSourceNotice({ snapshot }: { snapshot: AvailabilityWeekSnapshot }) {
  const court = snapshot.courts[0];

  return (
    <div className={`mock-notice ${snapshot.source === "supabase" ? "mock-notice--connected" : ""}`} role="note">
      <span className="mock-notice__icon" aria-hidden="true">i</span>
      <div>
        <strong>{snapshot.source === "mock-provisional" ? "Disponibilidad referencial" : snapshot.isProvisional ? "Disponibilidad por confirmar" : "Disponibilidad actualizada"}</strong>
        <p>
          {snapshot.source === "mock-provisional"
            ? "Esta agenda es referencial. Para confirmar un horario, utiliza el contacto directo del negocio."
            : snapshot.isProvisional
              ? `Consulta la disponibilidad${court ? ` de ${court.courtName}` : ""}. Algunos horarios pueden requerir confirmación antes de reservar.`
              : `Disponibilidad actualizada${court ? ` para ${court.courtName}` : ""}. Consulta por WhatsApp antes de confirmar una reserva.`}
        </p>
      </div>
    </div>
  );
}

function dayTabId(date: string) {
  return `availability-day-tab-${date}`;
}

function dayPanelId(date: string) {
  return `availability-day-panel-${date}`;
}

export function AvailabilityCalendar({
  businessSlug,
  businessName,
  businessTimezone,
  initialCourtId,
  courtSports,
  initialSportSlug,
  contactPhoneE164,
}: AvailabilityCalendarProps) {
  const repository = useMemo(() => createPublicAvailabilityRepository(), []);
  const [today, setToday] = useState<string | null>(null);
  const [weekReference, setWeekReference] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeCourtId, setActiveCourtId] = useState<string | null>(null);
  const [selectedSportSlug, setSelectedSportSlug] = useState(initialSportSlug ?? "");
  const [demoState, setDemoState] = useState<DemoState>("ready");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [snapshot, setSnapshot] = useState<AvailabilityWeekSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const current = businessTodayDateKey(new Date(), businessTimezone);
    setToday(current);
    setWeekReference(current);
    setSelectedDate(current);
    setDemoState(readDemoState());
  }, [businessTimezone]);

  useEffect(() => {
    setActiveCourtId(initialCourtId);
  }, [businessSlug, initialCourtId]);

  useEffect(() => {
    const options = courtSports[activeCourtId ?? ""] ?? [];
    setSelectedSportSlug((current) => options.some((sport) => sport.slug === current)
      ? current
      : options.find((sport) => sport.slug === initialSportSlug)?.slug ?? options[0]?.slug ?? "");
  }, [activeCourtId, courtSports, initialSportSlug]);

  useEffect(() => {
    if (!today || !weekReference || demoState !== "ready") return;

    let cancelled = false;
    setLoadState((current) => current === "ready" ? "ready" : "loading");
    setLoadError(null);

    repository
      .getWeek({
        businessSlug,
        referenceDateKey: weekReference,
        todayDateKey: today,
      })
      .then((nextSnapshot) => {
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setActiveCourtId((current) => {
          if (current && nextSnapshot.courts.some((court) => court.courtId === current)) return current;
          if (initialCourtId && nextSnapshot.courts.some((court) => court.courtId === initialCourtId)) return initialCourtId;
          return nextSnapshot.courts[0]?.courtId ?? null;
        });
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSnapshot(null);
        console.error("[availability] No se pudo actualizar la agenda pública.", error);
        setLoadError("No pudimos cargar la disponibilidad");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [businessSlug, demoState, initialCourtId, repository, today, weekReference, refreshNonce]);

  const snapshotSource = snapshot?.source;
  const snapshotBusinessId = snapshot?.businessId ?? null;

  useEffect(() => {
    if (snapshotSource !== "supabase") return;

    return subscribeToPublicAvailabilityChanges(snapshotBusinessId, () => {
      setRefreshNonce((value) => value + 1);
    });
  }, [snapshotBusinessId, snapshotSource]);

  useEffect(() => {
    if (snapshotSource !== "supabase") return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") setRefreshNonce((value) => value + 1);
    };
    const timer = window.setInterval(refreshWhenVisible, 30000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [snapshotSource]);

  const activeCourt = snapshot?.courts.find((court) => court.courtId === activeCourtId) ?? snapshot?.courts[0];
  const activeCourtSports = courtSports[activeCourt?.courtId ?? ""] ?? [];
  const days = activeCourt?.days ?? [];
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];

  function moveWeek(amount: -7 | 7) {
    if (!weekReference || !today) return;
    const nextReference = addDays(startOfWeekMonday(weekReference), amount);
    if (startOfWeekMonday(nextReference) < startOfWeekMonday(today)) return;
    setWeekReference(nextReference);
    setSelectedDate(nextReference);
  }

  function goToToday() {
    if (!today) return;
    setWeekReference(today);
    setSelectedDate(today);
  }

  function handleMobileDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!days.length) return;
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % days.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + days.length) % days.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = days.length - 1;
    else return;

    event.preventDefault();
    const nextDay = days[nextIndex];
    setSelectedDate(nextDay.date);
    window.requestAnimationFrame(() => document.getElementById(dayTabId(nextDay.date))?.focus());
  }

  function whatsappForSlot(slot: AvailabilitySlot) {
    if (!activeCourt || slot.status !== "available" || isPastLocalStart(slot.date, slot.start, activeCourt.timezone) || !contactPhoneE164) return null;
    const sportSlug = activeCourtSports.some((sport) => sport.slug === selectedSportSlug)
      ? selectedSportSlug : activeCourtSports[0]?.slug;
    if (!sportSlug) return null;
    return buildWhatsAppChatHref(
      contactPhoneE164,
      `Hola, quisiera consultar el horario en ${businessName} para ${activeCourt.courtName} (${sportSlug}), el ${slot.date} de ${slot.start} a ${slot.end}. ¿Podrían confirmar disponibilidad y tarifa?`,
    );
  }

  const canGoToPreviousWeek = Boolean(today && weekReference && startOfWeekMonday(weekReference) > startOfWeekMonday(today));

  if (!today || !weekReference || demoState === "loading" || loadState === "idle" || loadState === "loading") {
    return <LoadingState label="Cargando disponibilidad…" />;
  }

  if (demoState === "error" || loadState === "error") {
    return (
      <ErrorState
        title={loadError ?? "No pudimos cargar la disponibilidad"}
      />
    );
  }

  if (demoState === "empty" || !snapshot || !activeCourt || days.length === 0) {
    return (
      <EmptyState
        title="No hay horarios configurados para esta semana"
        detail="Puede significar que la cancha está cerrada o que todavía no hay bloques publicados para estos días."
      />
    );
  }

  return (
    <div className="availability-app" aria-live="polite">
      <div className="availability-toolbar">
        <div className="week-navigation" aria-label="Navegación semanal">
          <button className="week-nav-button" type="button" onClick={() => moveWeek(-7)} disabled={!canGoToPreviousWeek}>
            <span aria-hidden="true">←</span>
            <span>Semana anterior</span>
          </button>
          <button className="today-button" type="button" onClick={goToToday}>HOY</button>
          <button className="week-nav-button" type="button" onClick={() => moveWeek(7)}>
            <span>Semana siguiente</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <strong className="week-range">{formatWeekRange(days.map((day) => day.date))}</strong>
      </div>

      <DataSourceNotice snapshot={snapshot} />

      {snapshot.courts.length > 1 ? (
        <div className="court-picker" role="group" aria-label="Seleccionar cancha">
          <span>Cancha:</span>
          {snapshot.courts.map((court) => (
            <button
              key={court.courtId}
              type="button"
              className={court.courtId === activeCourt.courtId ? "court-picker__button court-picker__button--active" : "court-picker__button"}
              aria-pressed={court.courtId === activeCourt.courtId}
              onClick={() => {
                setActiveCourtId(court.courtId);
              }}
            >
              {court.courtName}
            </button>
          ))}
        </div>
      ) : null}

      {activeCourtSports.length > 1 ? <div className="availability-sport-choice" role="group" aria-label="Deporte para la consulta">
        <strong>¿Qué deporte vas a jugar?</strong>
        {activeCourtSports.map((sport) => <button key={sport.slug} type="button"
          className={sport.slug === selectedSportSlug ? "availability-sport-choice__active" : ""}
          aria-pressed={sport.slug === selectedSportSlug}
          onClick={() => setSelectedSportSlug(sport.slug)}>{sport.name}</button>)}
        <small>Ambos deportes comparten la disponibilidad del mismo campo físico.</small>
      </div> : null}

      <div className="availability-legend" aria-label="Leyenda de disponibilidad">
        <span><i className="status-dot status-dot--available" />Disponible</span>
        <span><i className="status-dot status-dot--occupied" />Ocupado</span>
        <span><i className="status-dot status-dot--unavailable" />No disponible</span>
      </div>

      <div className="desktop-week" aria-label={`Disponibilidad de siete días · ${activeCourt.courtName}`}>
        {days.map((day) => (
          <section className={`day-column ${day.isToday ? "day-column--today" : ""}`} key={day.date} aria-label={`${day.weekdayLong} ${day.dayNumber}`}>
            <header className="day-column__header">
              <span>{day.weekdayShort}</span>
              <strong>{day.dayNumber}</strong>
              <small>{day.monthShort}{day.isToday ? " · Hoy" : ""}</small>
            </header>
            <div className="day-column__slots">
              {day.slots.length ? day.slots.map((slot) => (
                <Slot
                  key={slot.id}
                  slot={slot}
                  compact
                  whatsappHref={whatsappForSlot(slot)}
                />
              )) : (
                <span className="day-column__empty">Sin horarios</span>
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mobile-week">
        <div className="mobile-day-selector" role="tablist" aria-label="Seleccionar día">
          {days.map((day) => {
            const isSelected = day.date === selectedDay?.date;
            return (
              <button
                className={`mobile-day ${isSelected ? "mobile-day--selected" : ""}`}
                key={day.date}
                id={dayTabId(day.date)}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={isSelected ? dayPanelId(day.date) : undefined}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setSelectedDate(day.date)}
                onKeyDown={(event) => handleMobileDayKeyDown(event, days.indexOf(day))}
              >
                <span>{day.weekdayShort}</span>
                <strong>{day.dayNumber}</strong>
                {day.isToday ? <small>Hoy</small> : <small>{day.monthShort}</small>}
              </button>
            );
          })}
        </div>

        {selectedDay ? (
          <section
            className="mobile-slot-list"
            id={dayPanelId(selectedDay.date)}
            role="tabpanel"
            aria-labelledby={dayTabId(selectedDay.date)}
          >
            <div className="mobile-slot-list__title">
              <div>
                <span className="eyebrow">DÍA SELECCIONADO</span>
                <h3>{selectedDay.weekdayLong} {selectedDay.dayNumber} {selectedDay.monthShort}</h3>
              </div>
              {selectedDay.isToday ? <span className="today-chip">Hoy</span> : null}
            </div>
            {selectedDay.slots.length ? selectedDay.slots.map((slot) => (
              <Slot
                key={slot.id}
                slot={slot}
                whatsappHref={whatsappForSlot(slot)}
              />
            )) : (
              <EmptyState title="Sin horarios" detail="No hay bloques configurados para este día." />
            )}
          </section>
        ) : null}
      </div>

      <p className="availability-footnote">
        Los horarios son informativos. Consulta por WhatsApp y espera la confirmación del negocio; abrir el chat no crea ni confirma una reserva.
      </p>
      {!contactPhoneE164 ? (
        <p className="availability-footnote" role="status">
          Este negocio aún no ha publicado un número de WhatsApp. Puedes revisar sus horarios, pero las solicitudes quedarán disponibles cuando configure su contacto.
        </p>
      ) : null}
    </div>
  );
}

