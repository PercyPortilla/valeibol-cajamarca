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
import { businessConfig } from "@/config/business";
import { isPastLocalStart } from "@/lib/booking";
import { createPublicAvailabilityRepository } from "@/lib/data/availabilityService";
import { subscribeToPublicAvailabilityChanges } from "@/lib/data/availabilityRealtime";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
  ReservationDialog,
  type ReservationSelection,
} from "@/components/booking/ReservationDialog";

type DemoState = "ready" | "loading" | "empty" | "error";
type LoadState = "idle" | "loading" | "ready" | "error";

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
  onRequest,
  bookable,
}: {
  slot: AvailabilitySlot;
  compact?: boolean;
  onRequest: (slot: AvailabilitySlot) => void;
  bookable: boolean;
}) {
  const effectiveStatus: SlotStatus = slot.status === "available" && !bookable ? "unavailable" : slot.status;
  return (
    <div className={`time-slot time-slot--${effectiveStatus} ${compact ? "time-slot--compact" : ""}`}>
      <div className="time-slot__main">
        <span className="time-slot__time">{formatTimeRange(slot.start, slot.end)}</span>
        <span className="time-slot__status">
          <i className={`status-dot status-dot--${effectiveStatus}`} aria-hidden="true" />
          {STATUS_LABELS[effectiveStatus]}
        </span>
      </div>
      {bookable ? (
        <button
          className="slot-cta"
          type="button"
          onClick={() => onRequest(slot)}
          aria-label={`Solicitar horario del ${slot.date}, ${slot.start} a ${slot.end}`}
        >
          Solicitar
        </button>
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
              : `Disponibilidad actualizada${court ? ` para ${court.courtName}` : ""}. Selecciona un bloque libre para enviar tu solicitud.`}
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

export function AvailabilityCalendar() {
  const repository = useMemo(() => createPublicAvailabilityRepository(), []);
  const [today, setToday] = useState<string | null>(null);
  const [weekReference, setWeekReference] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeCourtId, setActiveCourtId] = useState<string | null>(null);
  const [demoState, setDemoState] = useState<DemoState>("ready");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [snapshot, setSnapshot] = useState<AvailabilityWeekSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [reservationSelection, setReservationSelection] = useState<ReservationSelection | null>(null);

  useEffect(() => {
    const current = businessTodayDateKey();
    setToday(current);
    setWeekReference(current);
    setSelectedDate(current);
    setDemoState(readDemoState());
  }, []);

  useEffect(() => {
    if (!today || !weekReference || demoState !== "ready") return;

    let cancelled = false;
    setLoadState((current) => current === "ready" ? "ready" : "loading");
    setLoadError(null);

    repository
      .getWeek({
        businessSlug: businessConfig.slug,
        referenceDateKey: weekReference,
        todayDateKey: today,
      })
      .then((nextSnapshot) => {
        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setActiveCourtId((current) => {
          if (current && nextSnapshot.courts.some((court) => court.courtId === current)) return current;
          return nextSnapshot.courts[0]?.courtId ?? null;
        });
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSnapshot(null);
        setLoadError(error instanceof Error ? error.message : "Error desconocido al cargar disponibilidad.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [demoState, repository, today, weekReference, refreshNonce]);

  useEffect(() => {
    if (!snapshot || snapshot.source !== "supabase") return;

    return subscribeToPublicAvailabilityChanges(snapshot.businessId, () => {
      setRefreshNonce((value) => value + 1);
    });
  }, [snapshot?.businessId, snapshot?.source]);

  useEffect(() => {
    if (!snapshot || snapshot.source !== "supabase") return;

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
  }, [snapshot?.source]);

  const activeCourt = snapshot?.courts.find((court) => court.courtId === activeCourtId) ?? snapshot?.courts[0];
  const days = activeCourt?.days ?? [];
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];

  function moveWeek(amount: -7 | 7) {
    if (!weekReference) return;
    const nextReference = addDays(startOfWeekMonday(weekReference), amount);
    setWeekReference(nextReference);
    setSelectedDate(nextReference);
    setReservationSelection(null);
  }

  function goToToday() {
    if (!today) return;
    setWeekReference(today);
    setSelectedDate(today);
    setReservationSelection(null);
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

  function openReservation(slot: AvailabilitySlot, daySlots: AvailabilitySlot[]) {
    if (!snapshot || !activeCourt || slot.status !== "available" || isPastLocalStart(slot.date, slot.start, activeCourt.timezone)) return;
    setReservationSelection({
      courtId: activeCourt.courtId,
      courtName: activeCourt.courtName,
      slot,
      daySlots,
      source: snapshot.source,
      scheduleIsProvisional: snapshot.isProvisional,
    });
  }

  function refreshAvailability() {
    setRefreshNonce((value) => value + 1);
  }

  if (!today || !weekReference || demoState === "loading" || loadState === "idle" || loadState === "loading") {
    return <LoadingState label="Cargando disponibilidad…" />;
  }

  if (demoState === "error" || loadState === "error") {
    return (
      <ErrorState
        title={loadError ? `No pudimos cargar la disponibilidad: ${loadError}` : "No pudimos cargar la disponibilidad"}
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
          <button className="week-nav-button" type="button" onClick={() => moveWeek(-7)}>
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
                setReservationSelection(null);
              }}
            >
              {court.courtName}
            </button>
          ))}
        </div>
      ) : null}

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
                  bookable={slot.status === "available" && !isPastLocalStart(slot.date, slot.start, activeCourt.timezone)}
                  onRequest={(requested) => openReservation(requested, day.slots)}
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
                aria-controls={dayPanelId(day.date)}
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
                bookable={slot.status === "available" && !isPastLocalStart(slot.date, slot.start, activeCourt.timezone)}
                onRequest={(requested) => openReservation(requested, selectedDay.slots)}
              />
            )) : (
              <EmptyState title="Sin horarios" detail="No hay bloques configurados para este día." />
            )}
          </section>
        ) : null}
      </div>

      <p className="availability-footnote">
        “Solicitar” solo aparece en horarios disponibles. Tu solicitud queda <strong>Pendiente</strong> hasta que el negocio la confirme.
      </p>

      <ReservationDialog
        selection={reservationSelection}
        onClose={() => setReservationSelection(null)}
        onPersisted={refreshAvailability}
        onAvailabilityStale={refreshAvailability}
      />
    </div>
  );
}
