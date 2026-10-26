"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicAvailabilityRepository } from "@/lib/data/availabilityService";
import { businessTodayDateKey, type AvailabilityWeekSnapshot } from "@/lib/availability";
import { bookingLightingForInterval, calculateBookingPreview, crossesLightingCutoff, formatMoney, getContiguousEndOptions } from "@/lib/booking";
import { createPublicBookingRepository } from "@/lib/data/bookingService";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import { CustomerChangeRequestWithdrawalButton } from "@/components/account/CustomerChangeRequestWithdrawalButton";

type RequestStatus = "pending" | "approved" | "rejected";

export function CustomerReservationRescheduleRequest({
  reservationId,
  requestId,
  businessSlug,
  timezone,
  currentCourtId,
  requestStatus,
  resolutionKind,
  resolutionNote,
  canWithdrawPending,
  canRequest,
}: {
  reservationId: string;
  requestId: string | null;
  businessSlug: string;
  timezone: string;
  currentCourtId: string;
  requestStatus: RequestStatus | null;
  resolutionKind: string | null;
  resolutionNote: string | null;
  canWithdrawPending: boolean;
  canRequest: boolean;
}) {
  const router = useRouter();
  const repository = useMemo(() => createPublicAvailabilityRepository(), []);
  const bookingRepository = useMemo(() => createPublicBookingRepository(), []);
  const [open, setOpen] = useState(false);
  const [referenceDate, setReferenceDate] = useState("");
  const [snapshot, setSnapshot] = useState<AvailabilityWeekSnapshot | null>(null);
  const [courtId, setCourtId] = useState(currentCourtId);
  const [date, setDate] = useState("");
  const [startSlotId, setStartSlotId] = useState("");
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ total: number; hourlyRate: number; currency: string } | null>(null);
  const businessResponse = resolutionKind === "admin_resolution" && resolutionNote ? ` Respuesta del negocio: ${resolutionNote}` : "";

  useEffect(() => {
    if (!open || referenceDate) return;
    setReferenceDate(businessTodayDateKey(new Date(), timezone));
  }, [open, referenceDate, timezone]);

  useEffect(() => {
    if (!open || !referenceDate) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    void repository.getWeek({
      businessSlug,
      referenceDateKey: referenceDate,
      todayDateKey: businessTodayDateKey(new Date(), timezone),
    }).then((next) => {
      if (cancelled) return;
      setSnapshot(next);
      const court = next.courts.find((item) => item.courtId === currentCourtId) ?? next.courts[0];
      setCourtId(court?.courtId ?? "");
      const day = court?.days.find((item) => item.date === referenceDate && item.slots.some((slot) => slot.status === "available"))
        ?? court?.days.find((item) => item.slots.some((slot) => slot.status === "available"));
      setDate(day?.date ?? referenceDate);
      const start = day?.slots.find((slot) => slot.status === "available");
      setStartSlotId(start?.id ?? "");
      setEndTime(start ? getContiguousEndOptions(day?.slots ?? [], start.id)[0]?.end ?? "" : "");
    }).catch(() => {
      if (!cancelled) setMessage("No pudimos cargar la disponibilidad real para reprogramar.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [businessSlug, currentCourtId, open, referenceDate, repository, timezone]);

  const selectedCourt = snapshot?.courts.find((item) => item.courtId === courtId) ?? null;
  const selectedDay = selectedCourt?.days.find((item) => item.date === date) ?? null;
  const availableStarts = selectedDay?.slots.filter((slot) => slot.status === "available") ?? [];
  const selectedStart = selectedDay?.slots.find((slot) => slot.id === startSlotId && slot.status === "available") ?? null;
  const endOptions = getContiguousEndOptions(selectedDay?.slots ?? [], startSlotId)
    .filter((option) => selectedStart ? !crossesLightingCutoff(selectedStart.start, option.end) : false);

  useEffect(() => {
    if (!open || !selectedStart || !endTime || !courtId || !date) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    void bookingRepository.getPricingForDate(businessSlug, date, courtId).then((pricing) => {
      if (cancelled) return;
      const lighting = bookingLightingForInterval(selectedStart.start, endTime);
      const rule = pricing.pricing.find((item) => item.lighting === lighting);
      if (!rule) {
        setQuote(null);
        return;
      }
      const preview = calculateBookingPreview(selectedStart.start, endTime, lighting, {
        withoutLights: lighting === "without_lights" ? rule.hourlyRate : rule.hourlyRate,
        withLights: lighting === "with_lights" ? rule.hourlyRate : rule.hourlyRate,
      });
      setQuote({ total: preview.total, hourlyRate: preview.hourlyRate, currency: pricing.currency });
    }).catch(() => {
      if (!cancelled) setQuote(null);
    });
    return () => { cancelled = true; };
  }, [bookingRepository, businessSlug, courtId, date, endTime, open, selectedStart]);

  if (requestStatus === "pending") return <div className="account-withdrawal"><small className="account-contact-unavailable">{canWithdrawPending ? "Reprogramación solicitada · tu horario original sigue reservado." : "La solicitud de reprogramación ya venció y está pendiente de cierre por el negocio."}</small>{requestId && canWithdrawPending ? <CustomerChangeRequestWithdrawalButton requestId={requestId} label="solicitud de reprogramación" /> : null}</div>;
  if (requestStatus === "rejected" && resolutionKind === "customer_expiration" && !canRequest) return <small className="account-contact-unavailable">La solicitud de reprogramación expiró sin modificar tu reserva.</small>;
  if (requestStatus === "rejected" && resolutionKind === "customer_withdrawal" && !canRequest) return <small className="account-contact-unavailable">Retiraste tu solicitud de reprogramación. Tu horario original no fue modificado.</small>;
  if (!canRequest && requestStatus === "approved") return <small className="account-contact-unavailable">Reprogramación aprobada.{businessResponse}</small>;
  if (!canRequest && requestStatus === "rejected") return <small className="account-contact-unavailable">Reprogramación rechazada. Ya no está disponible una nueva solicitud para esta reserva.{businessResponse}</small>;

  async function submit() {
    if (busy || !selectedDay || !startSlotId || !endTime || !courtId) return;
    const startSlot = selectedDay.slots.find((slot) => slot.id === startSlotId && slot.status === "available");
    if (!startSlot) {
      setMessage("Selecciona un horario disponible.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("request_my_reservation_reschedule", {
        p_reservation_id: reservationId,
        p_court_id: courtId,
        p_date: selectedDay.date,
        p_start_time: startSlot.start,
        p_end_time: endTime,
        p_reason: reason.trim() || null,
      });
      if (error) {
        const normalized = error.message.toLowerCase();
        setMessage(normalized.includes("slot_unavailable")
          ? "Ese horario dejó de estar disponible. Elige otro."
          : normalized.includes("reservation_payment_requires_business_reschedule")
            ? "Esta reserva requiere coordinación directa con el negocio antes de cambiar su horario."
            : "No pudimos registrar la reprogramación. Actualiza la disponibilidad e inténtalo nuevamente.");
        return;
      }
      setOpen(false);
      setMessage("Reprogramación solicitada. El horario original sigue reservado hasta la aprobación del negocio.");
      router.refresh();
    } catch {
      setMessage("No pudimos conectar con el servicio de reservas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-withdrawal">
      {requestStatus === "approved" && canRequest ? <small className="account-contact-unavailable">La reprogramación anterior fue aprobada. Puedes solicitar otro cambio mientras la reserva siga confirmada y futura.{businessResponse}</small> : null}
      {requestStatus === "rejected" && canRequest ? <small className="account-contact-unavailable">{resolutionKind === "customer_expiration" ? "La solicitud anterior expiró. Puedes elegir otro horario y volver a intentarlo." : resolutionKind === "customer_withdrawal" ? "Retiraste la solicitud anterior. Puedes elegir otro horario y volver a intentarlo." : `La solicitud anterior fue rechazada. Puedes elegir otro horario y volver a intentarlo.${businessResponse}`}</small> : null}
      {!open ? <button className="button button--secondary" type="button" onClick={() => setOpen(true)}>Solicitar cambio de horario</button> : (
        <div className="account-withdrawal__confirm" role="group" aria-label="Solicitar reprogramación">
          <p>El horario original seguirá reservado hasta que el negocio apruebe el cambio.</p>
          <label className="field"><span className="field__label">Semana de búsqueda</span><input className="field__control" type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)} /></label>
          {loading ? <p role="status">Cargando disponibilidad…</p> : null}
          {snapshot ? <>
            <label className="field"><span className="field__label">Cancha</span><select className="field__control" value={courtId} onChange={(event) => { const nextCourt = snapshot.courts.find((court) => court.courtId === event.target.value); setCourtId(event.target.value); const nextDay = nextCourt?.days.find((item) => item.slots.some((slot) => slot.status === "available")); setDate(nextDay?.date ?? ""); const start = nextDay?.slots.find((slot) => slot.status === "available"); setStartSlotId(start?.id ?? ""); setEndTime(start ? getContiguousEndOptions(nextDay?.slots ?? [], start.id)[0]?.end ?? "" : ""); }}><option value="">Selecciona</option>{snapshot.courts.map((court) => <option key={court.courtId} value={court.courtId}>{court.courtName}</option>)}</select></label>
            <label className="field"><span className="field__label">Fecha</span><select className="field__control" value={date} onChange={(event) => { const nextDate = event.target.value; const nextDay = selectedCourt?.days.find((item) => item.date === nextDate); setDate(nextDate); const start = nextDay?.slots.find((slot) => slot.status === "available"); setStartSlotId(start?.id ?? ""); setEndTime(start ? getContiguousEndOptions(nextDay?.slots ?? [], start.id)[0]?.end ?? "" : ""); }}>{selectedCourt?.days.filter((day) => day.slots.some((slot) => slot.status === "available")).map((day) => <option key={day.date} value={day.date}>{day.date}</option>)}</select></label>
            <label className="field"><span className="field__label">Inicio</span><select className="field__control" value={startSlotId} onChange={(event) => { setStartSlotId(event.target.value); setEndTime(getContiguousEndOptions(selectedDay?.slots ?? [], event.target.value)[0]?.end ?? ""); }}>{availableStarts.map((slot) => <option key={slot.id} value={slot.id}>{slot.start}</option>)}</select></label>
            <label className="field"><span className="field__label">Fin</span><select className="field__control" value={endTime} onChange={(event) => setEndTime(event.target.value)}>{endOptions.map((option) => <option key={option.end} value={option.end}>{option.label}</option>)}</select></label>
            {quote ? <p className="booking-policy">Valor estimado del nuevo horario: <strong>{formatMoney(quote.total, quote.currency)}</strong> · {formatMoney(quote.hourlyRate, quote.currency)}/h. El servidor volverá a validar este valor al aprobar.</p> : null}
            <label className="field"><span className="field__label">Motivo (opcional)</span><textarea className="field__control" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          </> : null}
          <div><button className="button button--primary" type="button" disabled={busy || loading || !startSlotId || !endTime} onClick={() => void submit()}>{busy ? "Enviando…" : "Enviar reprogramación"}</button><button className="button button--ghost" type="button" disabled={busy} onClick={() => setOpen(false)}>Volver</button></div>
        </div>
      )}
      {message ? <p className="account-withdrawal__feedback" role="status">{message}</p> : null}
    </div>
  );
}

