"use client";

import { useEffect, useMemo, useState } from "react";
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
        <strong>{snapshot.sourceLabel}</strong>
        <p>
          {snapshot.source === "mock-provisional"
            ? "Se está usando el fallback provisional porque no hay credenciales públicas de Supabase configuradas. Estos horarios y estados son demostrativos y no representan reservas reales de Valeibol."
            : snapshot.isProvisional
              ? `La disponibilidad proviene de Supabase${court ? ` para ${court.courtName}` : ""}, pero el horario de apertura continúa marcado como provisional hasta que el propietario lo confirme.`
              : `La disponibilidad proviene de Supabase${court ? ` para ${court.courtName}` : ""}. La vista pública solo recibe intervalos sanitizados, nunca datos personales de clientes.`}
        </p>
      </div>
    </div>
  );
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
        detail="Puede significar que la cancha está cerrada, que el horario todavía no fue configurado o que la fuente de datos no devolvió una cancha activa."
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
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedDate(day.date)}
              >
                <span>{day.weekdayShort}</span>
                <strong>{day.dayNumber}</strong>
                {day.isToday ? <small>Hoy</small> : <small>{day.monthShort}</small>}
              </button>
            );
          })}
        </div>

        {selectedDay ? (
          <section className="mobile-slot-list" role="tabpanel" aria-label={`Horarios de ${selectedDay.weekdayLong}`}>
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
        “Solicitar” solo aparece en horarios disponibles. Una solicitud real se crea como <strong>Pendiente</strong> y bloquea temporalmente ese intervalo para evitar dobles solicitudes; no se considera confirmada hasta aprobación del propietario.
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
