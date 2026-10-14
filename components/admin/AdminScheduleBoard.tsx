"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "../../lib/auth.ts";
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
import { calculateBookingPreview, formatMoney } from "../../lib/booking.ts";
import { businessConfig } from "../../config/business.ts";
import {
  cancelReservationAction,
  confirmReservationAction,
  createManualReservationAction,
  createScheduleBlockAction,
  editReservationAction,
  unblockScheduleAction,
  type AdminActionResult,
} from "../../app/admin/(protected)/actions.ts";

const WEEKDAY = new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" });
const MONTH_DAY = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" });

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

function statusClass(status: ReturnType<typeof buildAdminBoardSlots>[number]["status"]) {
  return `admin-slot admin-slot--${status}`;
}

function sourceLabel(source: AdminReservationScheduleEntry["source"]) {
  if (source === "public_web") return "Web pública";
  return adminSourceLabel(source);
}

function ActionFeedback({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return (
    <div className={result.ok ? "admin-feedback admin-feedback--success" : "admin-feedback admin-feedback--error"} role="status">
      {result.message}
    </div>
  );
}

export function AdminScheduleBoard({
  snapshot,
  timezone,
  role,
}: {
  snapshot: AdminScheduleSnapshot;
  timezone: string;
  role: AdminRole;
}) {
  const router = useRouter();
  const [activeCourtId, setActiveCourtId] = useState(snapshot.courts[0]?.courtId ?? "");
  const [selectedDate, setSelectedDate] = useState(snapshot.from);
  const [panel, setPanel] = useState<PanelState>(null);
  const [feedback, setFeedback] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const activeCourt = snapshot.courts.find((court) => court.courtId === activeCourtId) ?? snapshot.courts[0];
  const days = activeCourt?.days ?? [];
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0];

  const daySlots = useMemo(
    () => new Map(days.map((day) => [day.date, buildAdminBoardSlots(day, timezone)])),
    [days, timezone],
  );

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

  function cancelReservation(id: string) {
    if (!window.confirm("¿Cancelar esta reserva? El intervalo se liberará si no existe otra ocupación.")) return;
    completeAction(() => cancelReservationAction(id));
  }

  function unblock(id: string) {
    if (!window.confirm("¿Retirar este bloqueo? El horario volverá a calcularse como disponible si no hay otra ocupación.")) return;
    completeAction(() => unblockScheduleAction(id));
  }

  function renderEntry(entry: AdminScheduleEntry) {
    if (entry.entryKind === "block") {
      return (
        <div className="admin-slot__entry">
          <strong>{blockReasonLabel(entry.blockReason)}</strong>
          {entry.internalNote ? <small>{entry.internalNote}</small> : null}
          {entry.status === "active" && canPerformAdminOperation(role, "unblock") ? (
            <button className="admin-mini-action admin-mini-action--danger" type="button" disabled={pending} onClick={() => unblock(entry.id)}>
              Desbloquear
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <div className="admin-slot__entry">
        <strong>{entry.customerName ?? "Cliente sin nombre"}</strong>
        <small>{entry.customerPhoneE164 ?? "Sin teléfono"}</small>
        <small>{entry.lighting === "with_lights" ? "Con luz" : "Sin luz"} · {formatMoney(entry.totalAmount, entry.currency)}</small>
        <small>{sourceLabel(entry.source)}</small>
        <div className="admin-slot__actions">
          {entry.status === "pending" && canPerformAdminOperation(role, "confirm_reservation") ? (
            <button className="admin-mini-action" type="button" disabled={pending} onClick={() => confirmReservation(entry.id)}>Confirmar</button>
          ) : null}
          {(entry.status === "pending" || entry.status === "confirmed") && canPerformAdminOperation(role, "cancel_reservation") ? (
            <button className="admin-mini-action admin-mini-action--danger" type="button" disabled={pending} onClick={() => cancelReservation(entry.id)}>Cancelar</button>
          ) : null}
          {(entry.status === "pending" || entry.status === "confirmed") && canPerformAdminOperation(role, "edit_reservation") ? (
            <button className="admin-mini-action" type="button" disabled={pending} onClick={() => setPanel({ kind: "edit", entry })}>Editar</button>
          ) : null}
        </div>
      </div>
    );
  }

  if (!activeCourt) {
    return <div className="state-card"><strong>No hay canchas activas configuradas.</strong></div>;
  }

  return (
    <div className="admin-schedule-app" aria-busy={pending}>
      <ActionFeedback result={feedback} />

      <div className="admin-schedule-toolbar">
        <div className="admin-court-tabs" role="group" aria-label="Cancha">
          {snapshot.courts.map((court) => (
            <button
              key={court.courtId}
              type="button"
              className={court.courtId === activeCourt.courtId ? "admin-court-tab admin-court-tab--active" : "admin-court-tab"}
              aria-pressed={court.courtId === activeCourt.courtId}
              onClick={() => {
                setActiveCourtId(court.courtId);
                setSelectedDate(court.days[0]?.date ?? snapshot.from);
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
      </div>

      <div className="admin-schedule-legend" aria-label="Leyenda administrativa">
        {(["available", "pending", "confirmed", "blocked", "completed", "unavailable"] as const).map((status) => (
          <span key={status}><i className={`admin-status-dot admin-status-dot--${status}`} />{adminScheduleStatusLabel(status)}</span>
        ))}
      </div>

      <div className="admin-week-board" aria-label={`Pizarra semanal de ${activeCourt.courtName}`}>
        {days.map((day) => {
          const slots = daySlots.get(day.date) ?? [];
          return (
            <section className="admin-day-column" key={day.date} aria-label={`${shortDay(day.date)} ${dayMonth(day.date)}`}>
              <header className="admin-day-column__header">
                <strong>{shortDay(day.date)}</strong>
                <span>{dayMonth(day.date)}</span>
                <small>{day.scheduleStatus === "provisional" ? "Horario provisional" : "Horario confirmado"}</small>
              </header>
              <div className="admin-day-column__slots">
                {!day.isOpen || slots.length === 0 ? <div className="admin-day-closed">No disponible</div> : slots.map((slot) => (
                  <article className={statusClass(slot.status)} key={slot.id}>
                    <div className="admin-slot__head">
                      <span>{slot.start}–{slot.end}</span>
                      <b>{adminScheduleStatusLabel(slot.status)}</b>
                    </div>
                    {slot.entry ? renderEntry(slot.entry) : null}
                    {!slot.entry && slot.status === "available" ? (
                      <div className="admin-slot__quick-actions">
                        <button type="button" onClick={() => setPanel({ kind: "manual", courtId: day.courtId, date: day.date, startTime: slot.start, endTime: slot.end })}>Reservar</button>
                        <button type="button" onClick={() => setPanel({ kind: "block", courtId: day.courtId, date: day.date, startTime: slot.start, endTime: slot.end })}>Bloquear</button>
                      </div>
                    ) : null}
                    {slot.releasedEntries.length ? <small className="admin-slot__released">{slot.releasedEntries.length} registro cancelado/liberado</small> : null}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="admin-mobile-days" role="tablist" aria-label="Seleccionar día">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            role="tab"
            aria-selected={selectedDay?.date === day.date}
            className={selectedDay?.date === day.date ? "admin-mobile-day admin-mobile-day--active" : "admin-mobile-day"}
            onClick={() => setSelectedDate(day.date)}
          >
            <span>{shortDay(day.date)}</span>
            <strong>{dayMonth(day.date)}</strong>
          </button>
        ))}
      </div>

      {selectedDay ? (
        <section className="admin-mobile-slot-list" aria-label={`Agenda de ${shortDay(selectedDay.date)} ${dayMonth(selectedDay.date)}`}>
          {(daySlots.get(selectedDay.date) ?? []).map((slot) => (
            <article className={statusClass(slot.status)} key={`mobile-${slot.id}`}>
              <div className="admin-slot__head"><span>{slot.start}–{slot.end}</span><b>{adminScheduleStatusLabel(slot.status)}</b></div>
              {slot.entry ? renderEntry(slot.entry) : null}
              {!slot.entry && slot.status === "available" ? (
                <div className="admin-slot__quick-actions">
                  <button type="button" onClick={() => setPanel({ kind: "manual", courtId: selectedDay.courtId, date: selectedDay.date, startTime: slot.start, endTime: slot.end })}>Reservar</button>
                  <button type="button" onClick={() => setPanel({ kind: "block", courtId: selectedDay.courtId, date: selectedDay.date, startTime: slot.start, endTime: slot.end })}>Bloquear</button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {panel ? (
        <AdminOperationPanel
          panel={panel}
          snapshot={snapshot}
          timezone={timezone}
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
  pending,
  onClose,
  onSubmit,
}: {
  panel: NonNullable<PanelState>;
  snapshot: AdminScheduleSnapshot;
  timezone: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (task: () => Promise<AdminActionResult>) => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const editParts = panel.kind === "edit" ? getLocalDateTimeParts(panel.entry.startAt, timezone) : null;
  const editEnd = panel.kind === "edit" ? getLocalDateTimeParts(panel.entry.endAt, timezone) : null;
  const initialCourtId = panel.kind === "edit"
    ? snapshot.courts.find((court) => court.days.some((day) => day.entries.some((entry) => entry.id === panel.entry.id)))?.courtId ?? snapshot.courts[0]?.courtId ?? ""
    : panel.courtId;
  const initialDate = panel.kind === "edit" ? editParts?.date ?? snapshot.from : panel.date;
  const initialStart = panel.kind === "edit" ? editParts?.time ?? "18:00" : panel.startTime ?? "18:00";
  const initialEnd = panel.kind === "edit" ? editEnd?.time ?? "19:00" : panel.endTime ?? "19:00";
  const [preview, setPreview] = useState(() => {
    if (panel.kind === "block") return null;
    try {
      return calculateBookingPreview(initialStart, initialEnd, panel.kind === "edit" ? panel.entry.lighting : "without_lights");
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

    const lighting = String(form.get("lighting") ?? "without_lights") as "without_lights" | "with_lights";
    const customerName = String(form.get("customerName") ?? "");
    const phoneE164 = String(form.get("phoneE164") ?? "");

    if (panel.kind === "edit") {
      onSubmit(() => editReservationAction({
        reservationId: panel.entry.id,
        courtId,
        date,
        startTime,
        endTime,
        lighting,
        customerName,
        phoneE164,
      }));
      return;
    }

    const source = String(form.get("source") ?? "admin") as "admin" | "phone" | "whatsapp" | "other";
    onSubmit(() => createManualReservationAction({ courtId, date, startTime, endTime, lighting, customerName, phoneE164, source }));
  }

  function updatePreview(form: HTMLFormElement) {
    if (panel.kind === "block") return;
    const data = new FormData(form);
    try {
      setPreview(calculateBookingPreview(
        String(data.get("startTime") ?? ""),
        String(data.get("endTime") ?? ""),
        String(data.get("lighting") ?? "without_lights") as "without_lights" | "with_lights",
      ));
    } catch {
      setPreview(null);
    }
  }

  const title = panel.kind === "manual" ? "Nueva reserva manual" : panel.kind === "block" ? "Bloquear horario" : "Editar reserva";

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="admin-operation-modal" role="dialog" aria-modal="true" aria-labelledby="admin-operation-title">
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
                <label className="field"><span className="field__label">Modalidad</span><select className="field__control" name="lighting" defaultValue={panel.kind === "edit" ? panel.entry.lighting : "without_lights"}><option value="without_lights">Sin luz · S/{businessConfig.pricing.withoutLights}/h</option><option value="with_lights">Con luz · S/{businessConfig.pricing.withLights}/h</option></select></label>
                {panel.kind === "manual" ? <label className="field"><span className="field__label">Origen</span><select className="field__control" name="source" defaultValue="admin"><option value="admin">Panel administrativo</option><option value="phone">Llamada</option><option value="whatsapp">WhatsApp</option><option value="other">Otro</option></select></label> : null}
              </div>
              <div className="admin-price-preview">
                <span>Estimación visual</span>
                <strong>{preview ? `${preview.durationHours} h · ${formatMoney(preview.total)}` : "Revisa el intervalo"}</strong>
                <small>La base de datos vuelve a calcular tarifa y total. El navegador no puede imponer el precio.</small>
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
