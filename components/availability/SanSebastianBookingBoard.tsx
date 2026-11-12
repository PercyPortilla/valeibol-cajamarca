"use client";

import { useEffect, useMemo, useState } from "react";
import { isPastLocalStart } from "@/lib/booking";
import { consecutiveAvailableEnd } from "@/lib/availabilitySelection";
import { buildUnconfiguredCalendarDays, formatWeekRange, startOfWeekMonday, type AvailabilityWeekSnapshot } from "@/lib/availability";
import { buildWhatsAppChatHref } from "@/lib/whatsapp/links";

export type ShowcaseBookingCourt = { courtId: string; courtName: string; bookable: boolean };

type Props = {
  businessName: string;
  businessTimezone: string;
  snapshot: AvailabilityWeekSnapshot;
  showcaseCourts: ShowcaseBookingCourt[];
  activeCourtId: string | null;
  onCourtChange: (courtId: string) => void;
  courtSports: Record<string, { slug: string; name: string }[]>;
  selectedSportSlug: string;
  onSportChange: (slug: string) => void;
  contactPhoneE164: string | null;
  selectedDate: string | null;
  onDateChange: (date: string) => void;
  today: string;
  weekReference: string;
  onWeekChange: (step: -7 | 7) => void;
  onToday: () => void;
};

export function SanSebastianBookingBoard({
  businessName, businessTimezone, snapshot, showcaseCourts, activeCourtId, onCourtChange,
  courtSports, selectedSportSlug, onSportChange, contactPhoneE164, selectedDate, onDateChange,
  today, weekReference, onWeekChange, onToday,
}: Props) {
  const [durationHours, setDurationHours] = useState(1);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [preferredDate, setPreferredDate] = useState<string | null>(null);

  const courts = useMemo(() => {
    const known = showcaseCourts.map((court) => ({ ...court }));
    for (const court of snapshot.courts) {
      if (!known.some((item) => item.courtId === court.courtId)) {
        known.push({ courtId: court.courtId, courtName: court.courtName, bookable: true });
      }
    }
    return known;
  }, [showcaseCourts, snapshot.courts]);
  const chosenCourt = courts.find((item) => item.courtId === activeCourtId) ?? courts[0];
  const operationalCourt = snapshot.courts.find((item) => item.courtId === chosenCourt?.courtId);
  // El showcase provisional no debe heredar accidentalmente la agenda de Campo 1.
  const pendingCourt = !chosenCourt?.bookable || !operationalCourt;
  const sports = courtSports[chosenCourt?.courtId ?? ""] ?? [];
  const sport = sports.find((item) => item.slug === selectedSportSlug) ?? sports[0];
  const days = !pendingCourt && operationalCourt ? operationalCourt.days : buildUnconfiguredCalendarDays(weekReference, today);
  const day = days.find((item) => item.date === selectedDate) ?? days[0];
  const durationMinutes = durationHours * 60;
  const selectedEnd = selectedStart && day && !pendingCourt
    ? consecutiveAvailableEnd(day.slots, selectedStart, durationMinutes) : null;
  const validSelection = !!selectedEnd && !!selectedStart && !!sport && !!operationalCourt
    && !isPastLocalStart(day.date, selectedStart, operationalCourt.timezone);

  useEffect(() => { setSelectedStart(null); }, [activeCourtId, selectedDate, durationHours, weekReference]);
  useEffect(() => { setPreferredDate(null); }, [activeCourtId, weekReference]);

  function chooseDay(date: string) {
    onDateChange(date);
    if (pendingCourt) setPreferredDate(date);
  }

  const details = validSelection
    ? `Hola, quisiera consultar ${durationHours} ${durationHours === 1 ? "hora" : "horas"} en ${businessName}, ${chosenCourt.courtName}, para ${sport.name}, el ${day.date} de ${selectedStart} a ${selectedEnd}. ¿Podrían confirmar disponibilidad y tarifa?`
    : pendingCourt && sport
      ? `Hola, quisiera consultar cuándo estará disponible ${chosenCourt?.courtName} de ${businessName} para ${sport.name}. Me interesan ${durationHours} ${durationHours === 1 ? "hora" : "horas"}${preferredDate ? `, preferentemente el ${preferredDate}` : ""}. ¿Podrían informarme horarios y tarifas reales?`
      : null;
  const chatHref = details && contactPhoneE164 ? buildWhatsAppChatHref(contactPhoneE164, details) : null;
  const availableCount = !pendingCourt && day
    ? day.slots.filter((slot) => slot.status === "available" &&
        !isPastLocalStart(slot.date, slot.start, operationalCourt!.timezone) &&
        consecutiveAvailableEnd(day.slots, slot.start, durationMinutes)).length : 0;

  return <div className="ss-booking-board" aria-label="Pizarra de horarios de San Sebastián">
    <div className="ss-booking-board__top">
      <div><h3>La pizarra de San Sebastián</h3><p>Tu cancha, tu deporte, tu próximo partido. Elige cómo quieres jugar.</p></div>
      <span className="ss-booking-board__tag"><span className="ss-booking-board__tag-dot" aria-hidden="true" /> Coordinación directa por WhatsApp</span>
    </div>
    <div className="ss-booking-board__choices">
      <fieldset className="ss-booking-board__choice"><legend>1. Elige tu campo</legend>
        <div className="ss-booking-board__buttons">
          {courts.map((court) => <button key={court.courtId} type="button"
            className={chosenCourt?.courtId === court.courtId ? "ss-booking-board__button is-selected" : "ss-booking-board__button"}
            aria-pressed={chosenCourt?.courtId === court.courtId}
            onClick={() => { setPreferredDate(null); onCourtChange(court.courtId); }}>{court.courtName}<small>{court.bookable ? "Agenda publicada" : "Agenda por configurar"}</small></button>)}
        </div>
      </fieldset>
      <fieldset className="ss-booking-board__choice"><legend>2. ¿Qué deporte jugarás?</legend>
        <div className="ss-booking-board__buttons">
          {sports.map((option) => <button key={option.slug} type="button"
            className={sport?.slug === option.slug ? "ss-booking-board__button is-selected" : "ss-booking-board__button"}
            aria-pressed={sport?.slug === option.slug}
            onClick={() => onSportChange(option.slug)}>{option.name}</button>)}
        </div>
      </fieldset>
      <fieldset className="ss-booking-board__choice"><legend>3. ¿Cuántas horas?</legend>
        <div className="ss-booking-board__buttons">
          {[1, 2, 3, 4].map((hours) => <button type="button" key={hours}
            className={durationHours === hours ? "ss-booking-board__button is-selected" : "ss-booking-board__button"}
            aria-pressed={durationHours === hours} onClick={() => setDurationHours(hours)}>
            {hours} {hours === 1 ? "hora" : "horas"}</button>)}
        </div>
      </fieldset>
    </div>

    <>
      {pendingCourt ? <div className="ss-booking-board__pending" role="status">
        <span className="ss-booking-board__pending-icon" aria-hidden="true">i</span>
        <div><strong>{chosenCourt?.courtName ?? "Campo"} · Horarios y tarifas por confirmar</strong>
          <p>Esta pizarra está habilitada para explorar los días, pero el propietario todavía no ha publicado horarios. No podemos indicar horas libres u ocupadas sin esa información.</p>
        </div>
      </div> : null}
      <div className="ss-booking-board__calendar">
        <div className="ss-booking-board__calendar-heading">
          <div><h3>4. {pendingCourt ? "Explora los días" : "Selecciona el día y la hora"}</h3>
            <p>{pendingCourt ? "Puedes señalar un día preferido para preguntar por su futura disponibilidad." : `Se consultan únicamente tramos continuos de ${durationHours} ${durationHours === 1 ? "hora" : "horas"}.`}</p>
          </div>
          <div className="ss-booking-board__week-nav" aria-label="Navegación de semanas">
            <button type="button" onClick={() => onWeekChange(-7)} disabled={startOfWeekMonday(weekReference) <= startOfWeekMonday(today)}>← Anterior</button>
            <button type="button" onClick={onToday}>Hoy</button>
            <button type="button" onClick={() => onWeekChange(7)}>Siguiente →</button>
          </div>
        </div>
        <p className="ss-booking-board__week-range">{formatWeekRange(days.map((item) => item.date))}</p>
        {!pendingCourt ? <div className="ss-booking-board__legend" aria-label="Estados de horarios">
          <span><i className="ss-booking-board__status-dot is-free" aria-hidden="true"/> Libre</span>
          <span><i className="ss-booking-board__status-dot is-busy" aria-hidden="true"/> Ocupado</span>
          <span><i className="ss-booking-board__status-dot is-unavailable" aria-hidden="true"/> No disponible</span>
        </div> : <p className="ss-booking-board__legend ss-booking-board__legend--pending">Sin disponibilidad publicada: ningún día se considera libre ni ocupado todavía.</p>}
        <div className="ss-booking-board__dates" role="group" aria-label="Seleccionar día">
          {days.map((item) => <button type="button" key={item.date}
            aria-pressed={day?.date === item.date}
            className={day?.date === item.date ? "ss-booking-board__date is-selected" : "ss-booking-board__date"}
            onClick={() => chooseDay(item.date)}>
            <span>{item.weekdayShort}</span><strong>{item.dayNumber}</strong><small>{item.isToday ? "Hoy" : item.monthShort}</small>
          </button>)}
        </div>
        <div className="ss-booking-board__times-heading">
          <strong>{day?.weekdayLong} {day?.dayNumber} {day?.monthShort}</strong>
          <span>{pendingCourt ? "Agenda no publicada" : `${availableCount} ${availableCount === 1 ? "inicio libre" : "inicios libres"} para ${durationHours} h`}</span>
        </div>
        {pendingCourt ? <div key={`${chosenCourt?.courtId}-${day?.date}`} className="ss-booking-board__unconfigured" role="status">
          <div className="ss-booking-board__unconfigured-mark" aria-hidden="true" />
          <strong>Sin horarios publicados para {chosenCourt?.courtName}</strong>
          <p>{preferredDate === day?.date ? "Tomaremos este día como tu preferencia para la consulta por WhatsApp." : "Elige un día si quieres indicar una preferencia. Las horas aparecerán aquí cuando el propietario configure el campo."}</p>
        </div> : day?.slots.length ? <div className="ss-booking-board__slots" key={`${chosenCourt?.courtId}-${day.date}-${durationHours}`}>
          {day.slots.map((slot) => {
            const end = consecutiveAvailableEnd(day.slots, slot.start, durationMinutes);
            const isPast = isPastLocalStart(slot.date, slot.start, businessTimezone);
            const selectable = slot.status === "available" && !!end && !isPast;
            const chosen = selectedStart === slot.start && selectable;
            const status = isPast ? "past" : slot.status;
            const statusText = isPast ? "Pasado" : slot.status === "available" ? "Libre" : slot.status === "occupied" ? "Ocupado" : "No disponible";
            return <button type="button" key={slot.id} disabled={!selectable} aria-pressed={chosen}
              data-slot-status={status}
              className={`ss-booking-board__slot${chosen ? " is-selected" : ""}`}
              onClick={() => setSelectedStart(slot.start)}>
              <strong>{slot.start}–{selectable ? end : slot.end}</strong>
              <span className="ss-booking-board__slot-status"><i aria-hidden="true" className={`ss-booking-board__status-dot is-${status}`} />{statusText}</span>
              {chosen ? <small className="ss-booking-board__slot-note">Horario elegido</small> : slot.status === "available" && !selectable && !isPast
                ? <small className="ss-booking-board__slot-note">No alcanza para {durationHours} h seguidas</small> : null}
            </button>;
          })}
        </div> : <p className="ss-booking-board__empty">Sin horas para este día. Elige otro día para consultar.</p>}
      </div>
      <div className="ss-booking-board__summary" aria-live="polite">
        <div><span>Tu consulta</span><strong>{chosenCourt?.courtName} · {sport?.name ?? "Elige deporte"} · {durationHours} {durationHours === 1 ? "hora" : "horas"}</strong>
          <small>{pendingCourt ? `Horarios por confirmar${preferredDate ? ` · Prefieres ${preferredDate}` : ""}` : validSelection ? `${day.date} · ${selectedStart} a ${selectedEnd}` : "Selecciona una hora libre para continuar"}</small></div>
        {(validSelection || pendingCourt) && chatHref ? <a className="ss-booking-board__cta" href={chatHref} target="_blank" rel="noopener noreferrer">{pendingCourt ? "Preguntar por este campo" : "Consultar este horario"}<span aria-hidden="true">↗</span></a>
          : <span className="ss-booking-board__cta ss-booking-board__cta--disabled" aria-disabled="true">{!contactPhoneE164 ? "WhatsApp no configurado" : "Elige un horario libre"}</span>}
      </div>
    </>
    <p className="ss-booking-board__disclaimer">Horarios sujetos a confirmación del negocio. Esta consulta no bloquea el campo ni crea una reserva o pago automático.</p>
  </div>;
}
