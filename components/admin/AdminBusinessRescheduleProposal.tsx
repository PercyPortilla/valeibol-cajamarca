"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proposeReservationRescheduleAction, type AdminActionResult } from "@/app/admin/(protected)/actions";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

type CourtOption = {
  court_id: string;
  court_name: string;
  booking_increment_minutes: number;
};

function localReservationParts(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export function AdminBusinessRescheduleProposal({
  reservationId,
  currentCourtId,
  startAt,
  endAt,
  timezone,
  hasPendingChange,
}: {
  reservationId: string;
  currentCourtId: string;
  startAt: string;
  endAt: string;
  timezone: string;
  hasPendingChange: boolean;
}) {
  const router = useRouter();
  const start = localReservationParts(startAt, timezone);
  const end = localReservationParts(endAt, timezone);
  const [open, setOpen] = useState(false);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [courtId, setCourtId] = useState(currentCourtId);
  const [date, setDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endTime, setEndTime] = useState(end.time);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function openForm() {
    setOpen(true);
    setResult(null);
    if (courts.length || loadingCourts) return;
    setLoadingCourts(true);
    try {
      const { data, error } = await createPublicBrowserSupabaseClient().rpc("get_admin_reschedule_courts", {
        p_reservation_id: reservationId,
      });
      if (error) {
        setResult({
          ok: false,
          code: error.message.toLowerCase().includes("reservation_customer_account_required") ? "conflict" : "unknown",
          message: error.message.toLowerCase().includes("reservation_customer_account_required")
            ? "El cliente debe tener una cuenta vinculada para responder una propuesta desde Mi cuenta."
            : "No pudimos cargar las canchas compatibles para esta reserva.",
        });
        return;
      }
      const next = (data ?? []) as CourtOption[];
      setCourts(next);
      if (!next.some((court) => court.court_id === courtId)) setCourtId(next[0]?.court_id ?? "");
    } catch {
      setResult({ ok: false, code: "network", message: "No pudimos conectar con el servicio de reservas." });
    } finally {
      setLoadingCourts(false);
    }
  }

  function submit() {
    if (pending || !courtId || !date || !startTime || !endTime) return;
    setResult(null);
    startTransition(async () => {
      const next = await proposeReservationRescheduleAction({
        reservationId,
        courtId,
        date,
        startTime,
        endTime,
        note,
      });
      setResult(next);
      if (next.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }

  if (hasPendingChange) {
    return <small className="admin-inline-feedback">Hay una solicitud o propuesta de cambio pendiente para esta reserva.</small>;
  }

  const increment = courts[0]?.booking_increment_minutes ?? 60;

  return (
    <div className="admin-reservation-actions">
      {!open ? (
        <button className="button button--secondary" type="button" onClick={() => void openForm()}>
          Proponer otro horario
        </button>
      ) : (
        <div className="admin-reschedule-proposal">
          <p>La reserva actual no se moverá hasta que el cliente acepte la propuesta desde Mi cuenta.</p>
          {loadingCourts ? <p role="status">Cargando canchas compatibles…</p> : null}
          {courts.length ? (
            <>
              <label className="field">
                <span className="field__label">Cancha</span>
                <select className="field__control" value={courtId} onChange={(event) => setCourtId(event.target.value)}>
                  {courts.map((court) => <option key={court.court_id} value={court.court_id}>{court.court_name}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Fecha propuesta</span>
                <input className="field__control" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Inicio</span>
                <input className="field__control" type="time" step={increment * 60} value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Fin</span>
                <input className="field__control" type="time" step={increment * 60} value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Nota para el cliente (opcional)</span>
                <textarea className="field__control" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <div className="admin-reservation-actions">
                <button className="button button--primary" type="button" disabled={pending} onClick={submit}>
                  {pending ? "Enviando…" : "Enviar propuesta"}
                </button>
                <button className="button button--ghost" type="button" disabled={pending} onClick={() => setOpen(false)}>Cerrar</button>
              </div>
            </>
          ) : !loadingCourts ? <p>No hay canchas activas compatibles con el deporte de esta reserva.</p> : null}
        </div>
      )}
      {result ? <span className={result.ok ? "admin-inline-feedback admin-inline-feedback--success" : "admin-inline-feedback admin-inline-feedback--error"} role={result.ok ? "status" : "alert"}>{result.message}</span> : null}
    </div>
  );
}
