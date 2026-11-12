"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "../../lib/auth.ts";
import type { AdminPricingRule } from "../../lib/admin/phase7.ts";
import {
  ADMIN_BLOCK_REASONS,
  adminSourceLabel,
  blockReasonLabel,
  canPerformAdminOperation,
  type AdminBlockReason,
} from "../../lib/admin/operations.ts";
import {
  adminScheduleStatusLabel,
  buildAdminBoardSlots,
  getLocalDateTimeParts,
  type AdminReservationScheduleEntry,
  type AdminScheduleEntry,
  type AdminScheduleSnapshot,
} from "../../lib/admin/schedule.ts";
import { buildCourtWeekIndicators, buildDailyWeekIndicators } from "../../lib/admin/weeklyCommand.ts";
import { slotMatchesAdminFilter, visibleBoardDates, type AdminBoardViewMode, type AdminBoardStatusFilter } from "../../lib/admin/boardPresentation.ts";
import { addDays } from "../../lib/availability.ts";
import {
  bookingLightingForInterval,
  calculateBookingPreview,
  formatMoney,
  NET_HEIGHT_PRESETS,
  netHeightLabel,
} from "../../lib/booking.ts";
import {
  cancelReservationAction,
  confirmReservationAction,
  createManualReservationAction,
  createScheduleBlockAction,
  editReservationAction,
  expirePendingReservationAction,
  rejectPendingReservationAction,
  unblockScheduleAction,
  type AdminActionResult,
} from "../../app/admin/(protected)/actions.ts";

const WEEKDAY = new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" });
const MONTH_DAY = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" });

type AdminBoardSlotView = ReturnType<typeof buildAdminBoardSlots>[number];

type PanelState =
  | { kind: "manual"; courtId: string; date: string; startTime?: string; endTime?: string }
  | { kind: "block"; courtId: string; date: string; startTime?: string; endTime?: string }
  | { kind: "edit"; entry: AdminReservationScheduleEntry }
  | null;

function dateToUtcNoon(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function shortDay(dateKey: string) {
  return WEEKDAY.format(dateToUtcNoon(dateKey)).replace(".", "");
}

function dayMonth(dateKey: string) {
  return MONTH_DAY.format(dateToUtcNoon(dateKey)).replace(".", "");
}

function localDateKey(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function statusClass(status: ReturnType<typeof buildAdminBoardSlots>[number]["status"]) {
  return `admin-slot admin-slot--${status}`;
}

function sourceLabel(source: AdminReservationScheduleEntry["source"]) {
  if (source === "public_web") return "Web pública";
  return adminSourceLabel(source);
}

function adminDayTabId(date: string) {
  return `admin-day-tab-${date}`;
}

function adminDayPanelId(date: string) {
  return `admin-day-panel-${date}`;
}

function pricingForDate(pricingRules: AdminPricingRule[], courtId: string, date: string) {
  const applicable = pricingRules
    .filter((rule) => rule.courtId === courtId
      && rule.isActive
      && rule.effectiveFrom <= date
      && (!rule.effectiveUntil || rule.effectiveUntil >= date))
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));

  const withoutLights = applicable.find((rule) => rule.lighting === "without_lights");
  const withLights = applicable.find((rule) => rule.lighting === "with_lights");
  if (!withoutLights || !withLights || withoutLights.currency !== withLights.currency) return null;

  return {
    rates: {
      withoutLights: withoutLights.hourlyRate,
      withLights: withLights.hourlyRate,
    },
    currency: withoutLights.currency,
  };
}

function calculateAdminPricePreview(
  pricingRules: AdminPricingRule[],
  courtId: string,
  date: string,
  start: string,
  end: string,
) {
  const pricing = pricingForDate(pricingRules, courtId, date);
  if (!pricing) return null;
  const lighting = bookingLightingForInterval(start, end);
  const preview = calculateBookingPreview(start, end, lighting, pricing.rates);
  return { ...preview, currency: pricing.currency, lighting };
}

function ActionFeedback({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return (
    <div className={result.ok ? "admin-feedback admin-feedback--success" : "admin-feedback admin-feedback--error"} role={result.ok ? "status" : "alert"}>
      {result.message}
    </div>
  );
}

export function AdminScheduleBoard({
  snapshot,
  timezone,
  role,
  pricingRules,
  nowIso,
  premiumCommand = false,
  initialDay = null,
}: {
  snapshot: AdminScheduleSnapshot;
  timezone: string;
  role: AdminRole;
  pricingRules: AdminPricingRule[];
  nowIso: string;
  premiumCommand?: boolean;
  initialDay?: string | null;
}) {
  const router = useRouter();
  const todayDate = useMemo(() => localDateKey(timezone), [timezone]);
  const initialSelectedDate = initialDay && initialDay >= snapshot.from && initialDay <= snapshot.to ? initialDay
    : snapshot.courts[0]?.days.some((day) => day.date === todayDate)
    ? todayDate
    : snapshot.from;
  const [activeCourtId, setActiveCourtId] = useState(snapshot.courts[0]?.courtId ?? "");
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>(null);
  const [feedback, setFeedback] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<AdminBoardViewMode>(premiumCommand ? "day" : "week");
  const [statusFilter, setStatusFilter] = useState<AdminBoardStatusFilter>("all");
  const [overviewOpen, setOverviewOpen] = useState(false);

  // Las navegaciones entre semanas cambian los props del Server Component.
  // Sin sincronizar, React puede conservar el día de la semana anterior.
  useEffect(() => {
    setSelectedDate(initialSelectedDate);
    setActiveSlotId(null);
    setPanel(null);
  }, [snapshot.from, initialSelectedDate]);

  const indicators = useMemo(() => buildCourtWeekIndicators(snapshot, new Date(nowIso)), [snapshot, nowIso]);
  const weeklyTrend = useMemo(() => buildDailyWeekIndicators(snapshot, new Date(nowIso)), [snapshot, nowIso]);
  const summary = useMemo(() => {
    const capacity = indicators.reduce((sum, item) => sum + item.capacityHours, 0);
    const occupied = indicators.reduce((sum, item) => sum + item.occupiedHours, 0);
    const currencies = new Set(indicators.filter((item) => item.reservationValue > 0).map((item) => item.currency));
    return {
      capacity, occupied,
      reserved: indicators.reduce((sum, item) => sum + item.reservedHours, 0),
      confirmed: indicators.reduce((sum, item) => sum + item.confirmedCount, 0),
      pending: indicators.reduce((sum, item) => sum + item.pendingCount, 0),
      percent: capacity > 0 ? Math.round(occupied / capacity * 1000) / 10 : 0,
      currency: currencies.size <= 1 ? [...currencies][0] ?? "PEN" : null,
      value: indicators.reduce((sum, item) => sum + item.reservationValue, 0),
    };
  }, [indicators]);

  const activeCourt = snapshot.courts.find((court) => court.courtId === activeCourtId) ?? snapshot.courts[0];
  const days = useMemo(() => activeCourt?.days ?? [], [activeCourt]);
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];

  const daySlots = useMemo(
    () => new Map(days.map((day) => [day.date, buildAdminBoardSlots(day, timezone, new Date(nowIso))])),
    [days, timezone, nowIso],
  );
  const slotsByCourtAndDay = useMemo(() => new Map(snapshot.courts.flatMap((court) =>
    court.days.map((day) => [`${court.courtId}:${day.date}`, buildAdminBoardSlots(day, timezone, new Date(nowIso))] as const))),
    [snapshot, timezone, nowIso]);
  const visibleDates = visibleBoardDates(snapshot.from, selectedDate, viewMode);
  const selectedCourtDays = snapshot.courts.map((court) => ({
    court,
    day: court.days.find((item) => item.date === selectedDate),
    slots: slotsByCourtAndDay.get(`${court.courtId}:${selectedDate}`) ?? [],
  }));
  const dayTimeKeys = [...new Set(selectedCourtDays.flatMap((item) => item.slots.map((slot) => slot.start)))].sort();
  const filteredDayStarts = dayTimeKeys.filter((time) => statusFilter === "all" || selectedCourtDays.some((item) => {
    const slot = item.slots.find((entry) => entry.start === time);
    return slot ? slotMatchesAdminFilter(slot, statusFilter) : false;
  }));

  function selectOperationalDate(date: string) {
    setActiveSlotId(null);
    setPanel(null);
    if (date < snapshot.from || date > snapshot.to) {
      router.push(`/admin/disponibilidad?week=${date}&day=${date}`);
    } else {
      setSelectedDate(date);
    }
  }

  function moveOperationalDate(direction: -1 | 1) {
    const steps = viewMode === "three" ? 3 : 1;
    selectOperationalDate(addDays(selectedDate, direction * steps));
  }

  function handleMobileDayKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
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
    setActiveSlotId(null);
    window.requestAnimationFrame(() => document.getElementById(adminDayTabId(nextDay.date))?.focus());
  }

  function completeAction(task: () => Promise<AdminActionResult>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await task();
      setFeedback(result);
      if (result.ok) {
        setPanel(null);
        router.refresh();
      }
      if (!result.ok && result.code === "unauthenticated") {
        window.setTimeout(() => router.push("/admin/login?reason=session"), 900);
      }
    });
  }

  function confirmReservation(id: string) {
    completeAction(() => confirmReservationAction(id));
  }

  function rejectReservation(id: string) {
    if (!window.confirm("¿Rechazar esta solicitud? El cliente verá que no fue aceptada y el intervalo se liberará.")) return;
    completeAction(() => rejectPendingReservationAction(id));
  }

  function expireReservation(id: string) {
    if (!window.confirm("¿Expirar esta solicitud vencida? Se cerrará sin registrarla como rechazo del negocio.")) return;
    completeAction(() => expirePendingReservationAction(id));
  }

  function cancelReservation(id: string) {
    if (!window.confirm("¿Cancelar esta reserva confirmada? El cliente verá la cancelación y el intervalo se liberará.")) return;
    completeAction(() => cancelReservationAction(id));
  }

  function unblock(id: string) {
    if (!window.confirm("¿Retirar este bloqueo? El horario volverá a calcularse como disponible si no hay otra ocupación.")) return;
    completeAction(() => unblockScheduleAction(id));
  }

  function renderEntrySummary(entry: AdminScheduleEntry) {
    if (entry.entryKind === "block") {
      return (
        <div className="admin-slot__summary">
          <strong>{blockReasonLabel(entry.blockReason)}</strong>
          <small>Bloqueo operativo</small>
        </div>
      );
    }

    return (
      <div className="admin-slot__summary">
        <strong>{entry.customerName ?? "Cliente sin nombre"}</strong>
        <small>{entry.lighting === "with_lights" ? "Con luz" : "Sin luz"} · {formatMoney(entry.totalAmount, entry.currency)}</small>
      </div>
    );
  }

  function renderEntryDetails(entry: AdminScheduleEntry) {
    if (entry.entryKind === "block") {
      return (
        <div className="admin-slot__details">
          {entry.internalNote ? <small>{entry.internalNote}</small> : <small>Sin nota interna.</small>}
          {entry.status === "active" && canPerformAdminOperation(role, "unblock") ? (
            <div className="admin-slot__actions">
              <button className="admin-mini-action admin-mini-action--danger" type="button" disabled={pending} onClick={() => unblock(entry.id)}>
                Desbloquear
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="admin-slot__details">
        <small>{entry.customerPhoneE164 ?? "Sin teléfono"}</small>
        <small>Red: {netHeightLabel(entry.netHeightCm)} · {sourceLabel(entry.source)}</small>
        <div className="admin-slot__actions">
          {entry.status === "pending" && new Date(entry.startAt).getTime() > new Date(nowIso).getTime() && canPerformAdminOperation(role, "confirm_reservation") ? (
            <button className="admin-mini-action" type="button" disabled={pending} onClick={() => confirmReservation(entry.id)}>Confirmar</button>
          ) : null}
          {entry.status === "pending" && new Date(entry.startAt).getTime() > new Date(nowIso).getTime() && canPerformAdminOperation(role, "reject_reservation") ? (
            <button className="admin-mini-action admin-mini-action--danger" type="button" disabled={pending} onClick={() => rejectReservation(entry.id)}>Rechazar</button>
          ) : null}
          {entry.status === "pending" && new Date(entry.startAt).getTime() <= new Date(nowIso).getTime() && canPerformAdminOperation(role, "expire_pending_reservation") ? (
            <button className="admin-mini-action admin-mini-action--danger" type="button" disabled={pending} onClick={() => expireReservation(entry.id)}>Expirar</button>
          ) : null}
          {entry.status === "confirmed" && canPerformAdminOperation(role, "cancel_reservation") ? (
            <button className="admin-mini-action admin-mini-action--danger" type="button" disabled={pending} onClick={() => cancelReservation(entry.id)}>Cancelar</button>
          ) : null}
          {entry.status === "pending" && entry.source !== "public_web" && new Date(entry.startAt).getTime() > new Date(nowIso).getTime() && canPerformAdminOperation(role, "edit_reservation") ? (
            <button className="admin-mini-action" type="button" disabled={pending} onClick={() => setPanel({ kind: "edit", entry })}>Editar</button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderSlot(
    slot: AdminBoardSlotView,
    day: { courtId: string; date: string },
    scope: "desktop" | "mobile" | "compare" | "daily" | "daily-mobile" | "three",
  ) {
    const interactive = slot.status !== "unavailable";
    const expanded = interactive && activeSlotId === slot.id;
    const detailId = `admin-slot-detail-${scope}-${slot.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const entryLabel = slot.entry?.entryKind === "reservation"
      ? slot.entry.customerName ?? "reserva"
      : slot.entry?.entryKind === "block"
        ? blockReasonLabel(slot.entry.blockReason)
        : adminScheduleStatusLabel(slot.status);

    return (
      <article className={`${statusClass(slot.status)}${expanded ? " admin-slot--expanded" : ""}`} key={`${scope}-${slot.id}`}>
        {interactive ? (
          <button
            type="button"
            className="admin-slot__toggle"
            aria-expanded={expanded}
            aria-controls={expanded ? detailId : undefined}
            aria-label={`${slot.start} a ${slot.end}, ${adminScheduleStatusLabel(slot.status)}, ${entryLabel}. ${expanded ? "Ocultar acciones" : "Mostrar acciones"}`}
            onClick={() => setActiveSlotId((current) => current === slot.id ? null : slot.id)}
          >
            <div className="admin-slot__head">
              <span>{slot.start}–{slot.end}</span>
              {slot.status === "available" ? premiumCommand ? <b>Libre</b> : null : <b>{adminScheduleStatusLabel(slot.status)}</b>}
            </div>
            {slot.entry ? renderEntrySummary(slot.entry) : null}
          </button>
        ) : (
          <div className="admin-slot__static" aria-label={`${slot.start} a ${slot.end}, no disponible`}>
            <div className="admin-slot__head">
              <span>{slot.start}–{slot.end}</span>
              {premiumCommand ? <b>No disponible</b> : null}
            </div>
          </div>
        )}

        {expanded ? (
          <div className="admin-slot__context" id={detailId}>
            {slot.entry ? renderEntryDetails(slot.entry) : (
              <div className="admin-slot__quick-actions" aria-label={`Acciones para ${slot.start} a ${slot.end}`}>
                {canPerformAdminOperation(role, "create_manual_reservation") ? (
                  <button type="button" onClick={() => setPanel({ kind: "manual", courtId: day.courtId, date: day.date, startTime: slot.start, endTime: slot.end })}>Reservar</button>
                ) : null}
                {canPerformAdminOperation(role, "create_block") ? (
                  <button type="button" onClick={() => setPanel({ kind: "block", courtId: day.courtId, date: day.date, startTime: slot.start, endTime: slot.end })}>Bloquear</button>
                ) : null}
                {!canPerformAdminOperation(role, "create_manual_reservation") && !canPerformAdminOperation(role, "create_block") ? (
                  <small>Sin acciones disponibles para tu rol.</small>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </article>
    );
  }

  function renderCourtQuickActions(courtId: string, date: string) {
    return <div className="ss-admin-court-actions" aria-label="Acciones administrativas de la cancha">
      {canPerformAdminOperation(role, "create_manual_reservation") ? <button type="button" disabled={pending}
        onClick={() => setPanel({ kind: "manual", courtId, date })}>+ Reserva</button> : null}
      {canPerformAdminOperation(role, "create_block") ? <button type="button" disabled={pending}
        onClick={() => setPanel({ kind: "block", courtId, date })}>Bloquear</button> : null}
    </div>;
  }

  if (!activeCourt) {
    return <div className="state-card"><strong>No hay canchas activas configuradas.</strong></div>;
  }

  return (
    <div className={premiumCommand ? "admin-schedule-app ss-admin-schedule-v3" : "admin-schedule-app"} aria-busy={pending}>
      <ActionFeedback result={feedback} />

      {premiumCommand ? <section className="admin-command" aria-label="Centro operativo semanal de San Sebastián">
        <div className="ss-admin-command__compact">
          <div><span className="admin-command__eyebrow">CENTRO DE CONTROL · SAN SEBASTIÁN</span>
            <strong>Dos campos. Una agenda clara.</strong>
            <small>{summary.percent.toFixed(1)}% de ocupación semanal · {summary.confirmed} reservas confirmadas · {summary.pending} pendientes</small>
          </div>
          <button type="button" aria-expanded={overviewOpen} aria-controls="ss-admin-overview-details"
            onClick={() => setOverviewOpen((open) => !open)}>{overviewOpen ? "Ocultar indicadores −" : "Ver indicadores y gráfica +"}</button>
        </div>
        {overviewOpen ? <div id="ss-admin-overview-details" className="ss-admin-command__details">
        <div className="admin-command__masthead">
          <div><span className="admin-command__eyebrow">SAN SEBASTIÁN / CONTROL DE CANCHAS</span>
            <h2>Tu semana, bajo control<span>.</span></h2>
            <p>Información de agenda real para {snapshot.from} al {snapshot.to}. Campo 1 y Campo 2 tienen ocupaciones independientes; fútbol y vóley comparten cada campo.</p>
          </div>
          <div className="admin-command__links" aria-label="Accesos rápidos">
            <Link href="/admin/reservas">Reservas ↗</Link>
            <Link href="/admin/precios">Tarifas ↗</Link>
            <Link href="/admin/configuracion/estructura">Horarios y canchas ↗</Link>
            <Link href="/admin/reportes">Reportes ↗</Link>
          </div>
        </div>
        <div className="admin-command__metrics" aria-label="Indicadores semanales">
          <div><span>Ocupación de agenda</span><strong>{summary.percent.toFixed(1)}%</strong><small>{summary.occupied.toFixed(1)} de {summary.capacity.toFixed(1)} h abiertas · incluye bloqueos y pendientes</small></div>
          <div><span>Horas reservadas</span><strong>{summary.reserved.toFixed(1)} h</strong><small>Franjas confirmadas o completadas</small></div>
          <div><span>Reservas confirmadas</span><strong>{summary.confirmed}</strong><small>{summary.pending} pendientes esta semana</small></div>
          <div><span>Valor de reservas</span><strong>{summary.currency ? formatMoney(summary.value, summary.currency) : "Varias monedas"}</strong><small>Confirmadas + completadas · no es dinero cobrado</small></div>
        </div>
        <div className="admin-command__courts" aria-label="Comparativa de campos">
          {indicators.map((indicator) => <button type="button" key={indicator.courtId}
            className={`admin-command__court${activeCourtId === indicator.courtId ? " is-current" : ""}`}
            aria-pressed={activeCourtId === indicator.courtId}
            onClick={() => { setActiveCourtId(indicator.courtId); setViewMode("day"); setOverviewOpen(false); setActiveSlotId(null); setPanel(null); }}>
            <span><strong>{indicator.courtName}</strong><small>Ir a la agenda diaria ↗</small></span>
            <strong className="admin-command__court-percent">{indicator.occupancyPercent.toFixed(1)}%</strong>
            <span className="admin-command__meter" aria-hidden="true"><i style={{ width: `${Math.min(100, indicator.occupancyPercent)}%` }}/></span>
            <small>{indicator.reservedHours.toFixed(1)} h reservadas · {indicator.confirmedCount} confirmadas · {indicator.activeBlocks} bloqueos</small>
          </button>)}
        </div>
        <div className="admin-command__trend" aria-label="Gráfica de ocupación diaria semanal">
          <div className="admin-command__trend-copy"><span className="admin-command__eyebrow">TENDENCIA DE OCUPACIÓN</span>
            <strong>Ritmo de la semana</strong><small>Porcentaje de horas abiertas con reservas, solicitudes o bloqueos. Pulsa un día para compararlo.</small></div>
          <div className="admin-command__trend-bars">
            {weeklyTrend.map((day) => <button key={day.date} type="button" aria-label={`${day.date}: ${day.occupancyPercent.toFixed(1)}% ocupado`}
              title={`${day.occupiedHours.toFixed(1)} de ${day.capacityHours.toFixed(1)} horas ocupadas`}
              onClick={() => { setSelectedDate(day.date); setViewMode("day"); setOverviewOpen(false); setActiveSlotId(null); }}>
              <strong>{day.occupancyPercent.toFixed(1)}%</strong>
              <span className="admin-command__trend-track"><i style={{ height: `${day.occupancyPercent}%` }}/></span>
              <small>{shortDay(day.date)} {dayMonth(day.date)}</small>
            </button>)}
          </div>
        </div>
        </div> : null}
        <div className="admin-command__viewbar">
          <div className="admin-command__switch" role="group" aria-label="Vista de agenda">
            <button type="button" className={viewMode === "day" ? "is-current" : ""} aria-pressed={viewMode === "day"} onClick={() => { setViewMode("day"); setActiveSlotId(null); }}>Día · 2 campos</button>
            <button type="button" className={viewMode === "three" ? "is-current" : ""} aria-pressed={viewMode === "three"} onClick={() => { setViewMode("three"); setActiveSlotId(null); }}>3 días</button>
            <button type="button" className={viewMode === "week" ? "is-current" : ""} aria-pressed={viewMode === "week"} onClick={() => { setViewMode("week"); setActiveSlotId(null); }}>Semana deslizante</button>
          </div>
          <span>Agenda real · Horarios y reservas independientes por campo</span>
        </div>
      </section> : null}

      {(!premiumCommand || viewMode === "week") ? <div className="admin-schedule-toolbar">
        <div className="admin-court-tabs" role="group" aria-label="Cancha">
          {snapshot.courts.map((court) => (
            <button
              key={court.courtId}
              type="button"
              className={court.courtId === activeCourt.courtId ? "admin-court-tab admin-court-tab--active" : "admin-court-tab"}
              aria-pressed={court.courtId === activeCourt.courtId}
              onClick={() => {
                setActiveCourtId(court.courtId);
                setSelectedDate(court.days.some((day) => day.date === todayDate) ? todayDate : court.days[0]?.date ?? snapshot.from);
                setActiveSlotId(null);
                setPanel(null);
              }}
            >
              {court.courtName}
            </button>
          ))}
        </div>
        <div className="admin-schedule-actions">
          <button
            type="button"
            className="button button--secondary"
            disabled={pending || !canPerformAdminOperation(role, "create_manual_reservation")}
            onClick={() => setPanel({ kind: "manual", courtId: activeCourt.courtId, date: selectedDay?.date ?? snapshot.from })}
          >
            + Reserva manual
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={pending || !canPerformAdminOperation(role, "create_block")}
            onClick={() => setPanel({ kind: "block", courtId: activeCourt.courtId, date: selectedDay?.date ?? snapshot.from })}
          >
            Bloquear horario
          </button>
        </div>
      </div> : null}

      <div className="admin-schedule-legend" aria-label="Leyenda administrativa">
        {(["available", "pending", "confirmed", "blocked", "completed", "unavailable"] as const).map((status) => (
          <span key={status}><i className={`admin-status-dot admin-status-dot--${status}`} />{adminScheduleStatusLabel(status)}</span>
        ))}
      </div>

      {(!premiumCommand || viewMode === "week") ? <div className={premiumCommand ? "ss-admin-week-scroll" : undefined} tabIndex={premiumCommand ? 0 : undefined}
        role={premiumCommand ? "region" : undefined} aria-label={premiumCommand ? "Semana completa, desplaza horizontalmente para consultar los siete días" : undefined}>
      <div className="admin-week-board" aria-label={`Pizarra semanal de ${activeCourt.courtName}`}>
        {days.map((day) => {
          const slots = daySlots.get(day.date) ?? [];
          const isToday = day.date === todayDate;
          return (
            <section className={isToday ? "admin-day-column admin-day-column--today" : "admin-day-column"} key={day.date} aria-label={`${shortDay(day.date)} ${dayMonth(day.date)}${isToday ? ", hoy" : ""}`}>
              <header className="admin-day-column__header">
                <div className="admin-day-column__title">
                  <strong>{shortDay(day.date)}</strong>
                  {isToday ? <b className="admin-day-today">HOY</b> : null}
                </div>
                <span>{dayMonth(day.date)}</span>
              </header>
              <div className="admin-day-column__slots">
                {!day.isOpen || slots.length === 0 ? <div className="admin-day-closed">No disponible</div> : slots.map((slot) => renderSlot(slot, day, "desktop"))}
              </div>
            </section>
          );
        })}
      </div></div> : null}

      {!premiumCommand ? <div className="admin-mobile-days" role="tablist" aria-label="Seleccionar día">
        {days.map((day) => {
          const isSelected = selectedDay?.date === day.date;
          const isToday = day.date === todayDate;
          return (
            <button
              key={day.date}
              id={adminDayTabId(day.date)}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={adminDayPanelId(day.date)}
              aria-label={`${shortDay(day.date)} ${dayMonth(day.date)}${isToday ? ", hoy" : ""}`}
              tabIndex={isSelected ? 0 : -1}
              className={`${isSelected ? "admin-mobile-day admin-mobile-day--active" : "admin-mobile-day"}${isToday ? " admin-mobile-day--today" : ""}`}
              onClick={() => {
                setSelectedDate(day.date);
                setActiveSlotId(null);
              }}
              onKeyDown={(event) => handleMobileDayKeyDown(event, days.indexOf(day))}
            >
              <span>{shortDay(day.date)}{isToday ? <em>HOY</em> : null}</span>
              <strong>{dayMonth(day.date)}</strong>
            </button>
          );
        })}
      </div> : null}

      {selectedDay && !premiumCommand ? (
        <section
          className="admin-mobile-slot-list"
          id={adminDayPanelId(selectedDay.date)}
          role="tabpanel"
          aria-labelledby={adminDayTabId(selectedDay.date)}
        >
          {(daySlots.get(selectedDay.date) ?? []).map((slot) => renderSlot(slot, selectedDay, "mobile"))}
        </section>
      ) : null}

      {premiumCommand && viewMode !== "week" ? <section className="ss-admin-v3-board" aria-label="Pizarra administrativa con horarios grandes">
        <div className="ss-admin-v3-board__top">
          <div><span className="admin-command__eyebrow">AGENDA OPERATIVA</span>
            <h3>{viewMode === "day" ? "Agenda diaria · dos campos" : "Planificación de tres días"}</h3>
            <p>Franjas legibles, reservas y bloqueos reales. Selecciona un horario para ver sus acciones.</p>
          </div>
          <div className="ss-admin-v3-board__controls">
            <div className="ss-admin-v3-board__arrows" role="group" aria-label="Navegar por fechas">
              <button type="button" onClick={() => moveOperationalDate(-1)} aria-label="Ver días anteriores">← Anterior</button>
              <button type="button" onClick={() => selectOperationalDate(todayDate)}>Hoy</button>
              <button type="button" onClick={() => moveOperationalDate(1)} aria-label="Ver días siguientes">Siguiente →</button>
            </div>
            <label className="ss-admin-v3-board__filter">Mostrar
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as AdminBoardStatusFilter); setActiveSlotId(null); }}>
                <option value="all">Todos los horarios</option>
                <option value="busy">Reservados y bloqueados</option>
                <option value="free">Solo libres</option>
              </select>
            </label>
          </div>
        </div>
        <div className="ss-admin-v3-board__date-strip" role="group" aria-label="Seleccionar fecha">
          {days.map((day) => <button key={day.date} type="button"
            className={visibleDates.includes(day.date) ? "is-current" : ""}
            aria-pressed={visibleDates.includes(day.date)}
            onClick={() => selectOperationalDate(day.date)}>
            <span>{shortDay(day.date)}</span><strong>{dayMonth(day.date)}</strong>
            {day.date === todayDate ? <small>Hoy</small> : null}
          </button>)}
        </div>

        {viewMode === "day" ? <div className="ss-admin-daily" aria-label={`Agenda del ${selectedDate}`}>
          <div className="ss-admin-daily__desktop" style={{ gridTemplateColumns: `92px repeat(${selectedCourtDays.length}, minmax(0, 1fr))` }}>
            <div className="ss-admin-daily__time-head">HORARIO</div>
            {selectedCourtDays.map(({ court, slots }) => <div className="ss-admin-daily__court-head" key={court.courtId}>
              <div><span>CANCHA FÍSICA</span><h4>{court.courtName}</h4>
                <small>{slots.filter((slot) => slot.status === "available").length} franjas libres hoy</small></div>
              {renderCourtQuickActions(court.courtId, selectedDate)}
            </div>)}
            {filteredDayStarts.map((time) => <div key={time} className="ss-admin-daily__hour-row">
              <span className="ss-admin-daily__hour">{time}</span>
              {selectedCourtDays.map(({ court, day, slots }) => <div className="ss-admin-daily__cell" key={court.courtId}>
                {day && slots.find((slot) => slot.start === time)
                  ? renderSlot(slots.find((slot) => slot.start === time)!, day, "daily")
                  : <span className="ss-admin-daily__closed">Cerrado</span>}
              </div>)}
            </div>)}
            {!filteredDayStarts.length ? <p className="ss-admin-v3-board__empty">No hay franjas que coincidan con este filtro.</p> : null}
          </div>
          <div className="ss-admin-daily__mobile">
            {selectedCourtDays.map(({ court, day, slots }) => <section className="ss-admin-daily__mobile-court" key={court.courtId}>
              <header><div><span>CANCHA FÍSICA</span><h4>{court.courtName}</h4></div>{renderCourtQuickActions(court.courtId, selectedDate)}</header>
              <div className="ss-admin-daily__mobile-list">
                {day ? slots.filter((slot) => slotMatchesAdminFilter(slot, statusFilter)).map((slot) =>
                  <div className="ss-admin-daily__mobile-row" key={slot.id}>
                    <span>{slot.start}</span>{renderSlot(slot, day, "daily-mobile")}
                  </div>) : null}
                {!day?.isOpen || !slots.some((slot) => slotMatchesAdminFilter(slot, statusFilter))
                  ? <p className="ss-admin-v3-board__empty">{!day?.isOpen ? "Campo cerrado ese día." : "No hay franjas con este filtro."}</p> : null}
              </div>
            </section>)}
          </div>
        </div> : null}

        {viewMode === "three" ? <div className="ss-admin-three__scroll" role="region" tabIndex={0}
          aria-label="Tres días de agenda, desplazamiento horizontal">
          <div className="ss-admin-three__grid">
            {visibleDates.map((date) => <article className="ss-admin-three__date" key={date}>
              <header><span>{shortDay(date)}</span><h4>{dayMonth(date)}</h4>
                <button type="button" onClick={() => { setSelectedDate(date); setViewMode("day"); setActiveSlotId(null); }}>Ver día completo ↗</button>
              </header>
              {snapshot.courts.map((court) => {
                const day = court.days.find((item) => item.date === date);
                const slots = (slotsByCourtAndDay.get(`${court.courtId}:${date}`) ?? [])
                  .filter((slot) => slotMatchesAdminFilter(slot, statusFilter));
                return <section className="ss-admin-three__court" key={court.courtId}>
                  <div className="ss-admin-three__court-heading"><h5>{court.courtName}</h5>{renderCourtQuickActions(court.courtId, date)}</div>
                  <div className="ss-admin-three__slots">
                    {day?.isOpen && slots.length ? slots.map((slot) => renderSlot(slot, day, "three"))
                      : <p className="ss-admin-v3-board__empty">{!day?.isOpen ? "Campo cerrado" : "Sin franjas con este filtro"}</p>}
                  </div>
                </section>;
              })}
            </article>)}
          </div>
        </div> : null}
        <p className="ss-admin-v3-board__footnote">Fútbol y vóley comparten la agenda de cada campo; los campos se gestionan por separado. Las consultas por WhatsApp no confirman una reserva ni acreditan un pago.</p>
      </section> : null}

      {panel ? (
        <AdminOperationPanel
          panel={panel}
          snapshot={snapshot}
          timezone={timezone}
          pricingRules={pricingRules}
          pending={pending}
          onClose={() => setPanel(null)}
          onSubmit={(task) => completeAction(task)}
        />
      ) : null}
    </div>
  );
}

function AdminOperationPanel({
  panel,
  snapshot,
  timezone,
  pricingRules,
  pending,
  onClose,
  onSubmit,
}: {
  panel: NonNullable<PanelState>;
  snapshot: AdminScheduleSnapshot;
  timezone: string;
  pricingRules: AdminPricingRule[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (task: () => Promise<AdminActionResult>) => void;
}) {
  const modalRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));
    focusables()[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusables();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      restoreFocusRef.current?.focus();
    };
  }, [onClose]);

  const editParts = panel.kind === "edit" ? getLocalDateTimeParts(panel.entry.startAt, timezone) : null;
  const editEnd = panel.kind === "edit" ? getLocalDateTimeParts(panel.entry.endAt, timezone) : null;
  const initialCourtId = panel.kind === "edit"
    ? snapshot.courts.find((court) => court.days.some((day) => day.entries.some((entry) => entry.id === panel.entry.id)))?.courtId ?? snapshot.courts[0]?.courtId ?? ""
    : panel.courtId;
  const initialDate = panel.kind === "edit" ? editParts?.date ?? snapshot.from : panel.date;
  const initialStart = panel.kind === "edit" ? editParts?.time ?? "18:00" : panel.startTime ?? "18:00";
  const initialEnd = panel.kind === "edit" ? editEnd?.time ?? "19:00" : panel.endTime ?? "19:00";
  const [netHeightChoice, setNetHeightChoice] = useState(panel.kind === "edit" && panel.entry.netHeightCm ? "custom" : "");
  const [preview, setPreview] = useState(() => {
    if (panel.kind === "block") return null;
    try {
      return calculateAdminPricePreview(
        pricingRules,
        initialCourtId,
        initialDate,
        initialStart,
        initialEnd,
      );
    } catch {
      return null;
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const courtId = String(form.get("courtId") ?? "");
    const date = String(form.get("date") ?? "");
    const startTime = String(form.get("startTime") ?? "");
    const endTime = String(form.get("endTime") ?? "");

    if (panel.kind === "block") {
      const reason = String(form.get("reason") ?? "other") as AdminBlockReason;
      const internalNote = String(form.get("internalNote") ?? "");
      onSubmit(() => createScheduleBlockAction({ courtId, date, startTime, endTime, reason, internalNote }));
      return;
    }

    const preset = NET_HEIGHT_PRESETS.find((option) => option.id === netHeightChoice);
    const netHeightCm = netHeightChoice === "custom"
      ? Number(form.get("customNetHeightCm"))
      : preset?.cm ?? Number.NaN;
    const customerName = String(form.get("customerName") ?? "");
    const phoneE164 = String(form.get("phoneE164") ?? "");

    if (panel.kind === "edit") {
      onSubmit(() => editReservationAction({
        reservationId: panel.entry.id,
        courtId,
        date,
        startTime,
        endTime,
        netHeightCm,
        customerName,
        phoneE164,
      }));
      return;
    }

    const source = String(form.get("source") ?? "admin") as "admin" | "phone" | "whatsapp" | "other";
    onSubmit(() => createManualReservationAction({ courtId, date, startTime, endTime, netHeightCm, customerName, phoneE164, source }));
  }

  function updatePreview(form: HTMLFormElement) {
    if (panel.kind === "block") return;
    const data = new FormData(form);
    try {
      setPreview(calculateAdminPricePreview(
        pricingRules,
        String(data.get("courtId") ?? ""),
        String(data.get("date") ?? ""),
        String(data.get("startTime") ?? ""),
        String(data.get("endTime") ?? ""),
      ));
    } catch {
      setPreview(null);
    }
  }

  const title = panel.kind === "manual" ? "Nueva reserva manual" : panel.kind === "block" ? "Bloquear horario" : "Editar reserva";

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section ref={modalRef} className="admin-operation-modal" role="dialog" aria-modal="true" aria-labelledby="admin-operation-title">
        <header>
          <div><span className="eyebrow">OPERACIÓN SEGURA</span><h2 id="admin-operation-title">{title}</h2></div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit} onChange={(event) => updatePreview(event.currentTarget)}>
          <div className="admin-form-grid">
            <label className="field"><span className="field__label">Cancha</span><select className="field__control" name="courtId" defaultValue={initialCourtId} required>{snapshot.courts.map((court) => <option key={court.courtId} value={court.courtId}>{court.courtName}</option>)}</select></label>
            <label className="field"><span className="field__label">Fecha</span><input className="field__control" type="date" name="date" defaultValue={initialDate} required /></label>
            <label className="field"><span className="field__label">Inicio</span><input className="field__control" type="time" name="startTime" step={snapshot.bookingIncrementMinutes * 60} defaultValue={initialStart} required /></label>
            <label className="field"><span className="field__label">Fin</span><input className="field__control" type="time" name="endTime" step={snapshot.bookingIncrementMinutes * 60} defaultValue={initialEnd} required /></label>
          </div>

          {panel.kind === "block" ? (
            <>
              <label className="field"><span className="field__label">Motivo</span><select className="field__control" name="reason" defaultValue="maintenance">{ADMIN_BLOCK_REASONS.map((reason) => <option key={reason} value={reason}>{blockReasonLabel(reason)}</option>)}</select></label>
              <label className="field"><span className="field__label">Nota interna opcional</span><input className="field__control" name="internalNote" maxLength={500} placeholder="Ej. mantenimiento de luminarias" /></label>
            </>
          ) : (
            <>
              <div className="admin-form-grid">
                <label className="field"><span className="field__label">Cliente</span><input className="field__control" name="customerName" defaultValue={panel.kind === "edit" ? panel.entry.customerName ?? "" : ""} minLength={2} maxLength={120} required /></label>
                <label className="field"><span className="field__label">WhatsApp</span><input className="field__control" name="phoneE164" inputMode="tel" defaultValue={panel.kind === "edit" ? panel.entry.customerPhoneE164 ?? "" : ""} placeholder="935 059 868" required /></label>
              </div>
              <div className="admin-form-grid">
                <label className="field">
                  <span className="field__label">Altura de red</span>
                  <select className="field__control" name="netHeightChoice" value={netHeightChoice} onChange={(event) => setNetHeightChoice(event.target.value)} required>
                    <option value="">Selecciona una altura</option>
                    {NET_HEIGHT_PRESETS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    <option value="custom">Personalizada · 1.80 m a 2.50 m</option>
                  </select>
                </label>
                {netHeightChoice === "custom" ? (
                  <label className="field">
                    <span className="field__label">Altura personalizada (cm)</span>
                    <input className="field__control" name="customNetHeightCm" type="number" min={180} max={250} step={1} defaultValue={panel.kind === "edit" ? panel.entry.netHeightCm ?? "" : ""} required />
                  </label>
                ) : null}
                {panel.kind === "manual" ? <label className="field"><span className="field__label">Origen</span><select className="field__control" name="source" defaultValue="admin"><option value="admin">Panel administrativo</option><option value="phone">Llamada</option><option value="whatsapp">WhatsApp</option><option value="other">Otro</option></select></label> : null}
              </div>
              <div className="admin-price-preview" role="status" aria-live="polite">
                <span>Estimación con tarifa vigente</span>
                <strong>{preview ? `${preview.durationHours} h · ${formatMoney(preview.total, preview.currency)}` : "Tarifa vigente no disponible"}</strong>
                <small>{preview ? `${preview.lighting === "with_lights" ? "Con luz" : "Sin luz"} · ${formatMoney(preview.hourlyRate, preview.currency)}/h. La iluminación se aplica automáticamente.` : "El servidor validará horario, cambio de tarifa de las 18:00 y precio antes de guardar."}</small>
              </div>
            </>
          )}

          <div className="admin-modal-actions">
            <button className="button button--ghost" type="button" onClick={onClose} disabled={pending}>Cancelar</button>
            <button className="button button--primary" type="submit" disabled={pending}>{pending ? "Procesando…" : panel.kind === "block" ? "Crear bloqueo" : panel.kind === "edit" ? "Guardar cambios" : "Crear reserva"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
