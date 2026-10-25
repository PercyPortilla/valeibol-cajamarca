"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { addDays } from "@/lib/availability";
import type { AdminInventoryCourt, AdminInventoryOperatingHour } from "@/lib/admin/inventory";
import type { Json } from "@/lib/data/supabase/database.types";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

const week = [
  [1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"],
  [5, "Viernes"], [6, "Sábado"], [7, "Domingo"],
] as const;

type DayHours = { weekday: number; isOpen: boolean; opensAt: string; closesAt: string };
type Feedback = { kind: "success" | "error"; message: string } | null;

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function hourForDate(rows: AdminInventoryOperatingHour[], weekday: number, date: string) {
  return rows
    .filter((row) => row.weekday === weekday && row.effectiveFrom <= date && (!row.effectiveUntil || row.effectiveUntil >= date))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null;
}

function weekForDate(court: AdminInventoryCourt, date: string): DayHours[] {
  return week.map(([weekday]) => {
    const row = hourForDate(court.operatingHours, weekday, date);
    return {
      weekday,
      isOpen: row?.isOpen ?? false,
      opensAt: row?.opensAt ?? "08:00",
      closesAt: row?.closesAt ?? "22:00",
    };
  });
}

function mutationMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("operating_hours_conflict_future_reservations")) {
    return "No se puede aplicar: existen reservas futuras pendientes o confirmadas que quedarían fuera del nuevo horario.";
  }
  if (normalized.includes("operating_hours_conflict_future_blocks")) {
    return "No se puede aplicar: existen bloqueos futuros activos que quedarían fuera del nuevo horario.";
  }
  if (normalized.includes("operating_hours_effective_date_not_future")) {
    return "El horario regular debe entrar en vigencia desde mañana o una fecha posterior.";
  }
  if (normalized.includes("at_least_one_open_day_required")) {
    return "Mantén al menos un día abierto. Si la cancha dejará de operar, desactívala desde su ficha.";
  }
  if (normalized.includes("invalid_weekly_hours")) return "Revisa los siete días y sus horas de apertura/cierre.";
  if (normalized.includes("operating_hours_range_conflict")) return "Existe un conflicto entre vigencias. Recarga la página e inténtalo nuevamente.";
  if (normalized.includes("court_not_found")) return "La cancha ya no pertenece a este negocio o fue eliminada.";
  return "No pudimos programar el horario regular.";
}

function daySummary(row: DayHours) {
  return row.isOpen ? `${row.opensAt}–${row.closesAt}` : "Cerrado";
}

export function AdminCourtHoursEditor({
  court,
  businessToday,
  canManage,
  onSaved,
}: {
  court: AdminInventoryCourt;
  businessToday: string;
  canManage: boolean;
  onSaved: () => void;
}) {
  const minimumDate = addDays(businessToday, 1);
  const [effectiveFrom, setEffectiveFrom] = useState(minimumDate);
  const [hours, setHours] = useState<DayHours[]>(() => weekForDate(court, minimumDate));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    setEffectiveFrom(minimumDate);
    setDirty(false);
  }, [minimumDate]);

  useEffect(() => {
    if (!dirty) setHours(weekForDate(court, effectiveFrom));
  }, [court, dirty, effectiveFrom]);

  const currentHours = useMemo(() => weekForDate(court, businessToday), [court, businessToday]);
  const futureVersions = useMemo(
    () => [...new Set(court.operatingHours.filter((row) => row.effectiveFrom > businessToday).map((row) => row.effectiveFrom))].sort(),
    [court.operatingHours, businessToday],
  );

  function changeEffectiveDate(next: string) {
    setEffectiveFrom(next);
    setHours(weekForDate(court, next));
    setDirty(false);
    setFeedback(null);
  }

  function updateDay(index: number, patch: Partial<DayHours>) {
    setDirty(true);
    setHours((current) => current.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || busy) return;
    if (!hours.some((day) => day.isOpen)) {
      setFeedback({ kind: "error", message: "Mantén al menos un día abierto. Si la cancha dejará de operar, desactívala desde su ficha." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const payload = hours.map((day) => ({
        weekday: day.weekday,
        is_open: day.isOpen,
        opens_at: day.isOpen ? day.opensAt : null,
        closes_at: day.isOpen ? day.closesAt : null,
      })) as unknown as Json;
      const { error } = await createPublicBrowserSupabaseClient().rpc("admin_schedule_court_operating_hours", {
        p_court_id: court.courtId,
        p_hours: payload,
        p_effective_from: effectiveFrom,
      });
      if (error) {
        setFeedback({ kind: "error", message: mutationMessage(error.message) });
        return;
      }
      setFeedback({ kind: "success", message: `Horario regular programado desde ${formatDate(effectiveFrom)}.` });
      setDirty(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-court-hours" aria-labelledby={`court-hours-${court.courtId}`}>
      <div className="admin-court-hours__head">
        <div><strong id={`court-hours-${court.courtId}`}>Horario regular</strong><small>La agenda y las métricas usan la vigencia correspondiente a cada fecha.</small></div>
      </div>

      <dl className="admin-court-hours__summary">
        {week.map(([weekday, label], index) => <div key={weekday}><dt>{label}</dt><dd>{daySummary(currentHours[index])}</dd></div>)}
      </dl>

      {futureVersions.length > 0 ? (
        <div className="admin-court-hours__future" role="note">
          <strong>Cambios programados</strong>
          <span>{futureVersions.map(formatDate).join(" · ")}</span>
        </div>
      ) : null}

      {canManage ? (
        <form className="admin-court-hours__editor" onSubmit={submit}>
          <label className="field admin-court-hours__date">
            <span className="field__label">Vigente desde</span>
            <input className="field__control" type="date" min={minimumDate} value={effectiveFrom} disabled={busy} onChange={(event) => changeEffectiveDate(event.target.value)} required />
          </label>
          <p className="admin-court-hours__help">Programa cambios desde mañana. Para cierres puntuales del día usa la pizarra de disponibilidad. Las reservas y bloqueos futuros incompatibles impiden guardar.</p>
          <fieldset className="admin-weekly-hours" disabled={busy}>
            <legend>Semana regular</legend>
            {week.map(([weekday, label], index) => {
              const day = hours[index];
              return (
                <div className="admin-weekly-hours__row" key={weekday}>
                  <label className="admin-access-toggle"><input type="checkbox" checked={day.isOpen} onChange={(event) => updateDay(index, { isOpen: event.target.checked })} /><span>{label}</span></label>
                  <input aria-label={`Apertura ${label}`} className="field__control" type="time" disabled={!day.isOpen || busy} value={day.opensAt} onChange={(event) => updateDay(index, { opensAt: event.target.value })} />
                  <input aria-label={`Cierre ${label}`} className="field__control" type="time" disabled={!day.isOpen || busy} value={day.closesAt} onChange={(event) => updateDay(index, { closesAt: event.target.value })} />
                </div>
              );
            })}
          </fieldset>
          <div className="admin-court-hours__actions">
            <Button type="submit" disabled={busy}>{busy ? "Programando…" : "Programar horario"}</Button>
          </div>
          {feedback ? <div className={feedback.kind === "error" ? "admin-structure-message admin-structure-message--error" : "admin-structure-message"} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</div> : null}
        </form>
      ) : null}
    </section>
  );
}
