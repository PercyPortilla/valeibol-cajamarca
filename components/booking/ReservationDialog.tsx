"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type SyntheticEvent } from "react";
import { businessConfig } from "@/config/business";
import { sportRequiresNetHeight } from "@/config/sports";
import {
  bookingLightingForInterval,
  calculateBookingPreview,
  crossesLightingCutoff,
  formatMoney,
  getContiguousEndOptions,
  isPastLocalStart,
  isNetHeightCm,
  isValidCustomerName,
  NET_HEIGHT_PRESETS,
  netHeightLabel,
  normalizeCustomerName,
  normalizePeruWhatsApp,
} from "@/lib/booking";
import type { AvailabilitySlot } from "@/lib/availability";
import { createPublicBookingRepository } from "@/lib/data/bookingService";
import {
  BookingRepositoryError,
  type PublicBookingResult,
} from "@/lib/data/repositories/bookingRepository";
import type { PublicPaymentMethod } from "@/lib/payments";

export type ReservationSelection = {
  courtId: string;
  courtName: string;
  sportSlug: string;
  timezone: string;
  slot: AvailabilitySlot;
  daySlots: AvailabilitySlot[];
  source: "supabase" | "mock-provisional";
  scheduleIsProvisional: boolean;
};

type Props = {
  businessSlug: string;
  paymentMethods?: PublicPaymentMethod[];
  selection: ReservationSelection | null;
  onClose: () => void;
  onPersisted: () => void;
  onAvailabilityStale: () => void;
};

function formatLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function makeRequestToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export function ReservationDialog({ businessSlug, paymentMethods = [], selection, onClose, onPersisted, onAvailabilityStale }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const repository = useMemo(() => createPublicBookingRepository(), []);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [netHeightPreset, setNetHeightPreset] = useState("");
  const [customNetHeightCm, setCustomNetHeightCm] = useState("");
  const [endTime, setEndTime] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [requestToken, setRequestToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicBookingResult | null>(null);
  const [pricingRates, setPricingRates] = useState<{ withoutLights: number; withLights: number }>({
    withoutLights: businessConfig.pricing.withoutLights,
    withLights: businessConfig.pricing.withLights,
  });
  const [pricingCurrency, setPricingCurrency] = useState<string>(businessConfig.currency);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const endOptions = useMemo(
    () => selection
      ? getContiguousEndOptions(selection.daySlots, selection.slot.id)
        .filter((option) => !crossesLightingCutoff(selection.slot.start, option.end))
      : [],
    [selection],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    try {
      if (selection && !dialog.open) dialog.showModal();
      if (!selection && dialog.open) dialog.close();
    } catch {
      // Avoid crashing the whole page during a rapid close/open transition.
      if (!selection) dialog.removeAttribute("open");
    }
  }, [selection]);

  useEffect(() => {
    if (!selection) return;
    setName("");
    setPhone("");
    setNetHeightPreset("");
    setCustomNetHeightCm("");
    setEndTime(
      getContiguousEndOptions(selection.daySlots, selection.slot.id)
        .find((option) => !crossesLightingCutoff(selection.slot.start, option.end))?.end
        ?? selection.slot.end,
    );
    setMarketingOptIn(false);
    setRequestToken(makeRequestToken());
    setSubmitting(false);
    setError(null);
    setResult(null);
    setPricingRates({
      withoutLights: businessConfig.pricing.withoutLights,
      withLights: businessConfig.pricing.withLights,
    });
    setPricingCurrency(businessConfig.currency);
    setPricingError(null);

    if (selection.source === "mock-provisional") {
      setPricingLoading(false);
      return;
    }

    let cancelled = false;
    setPricingLoading(true);
    repository.getPricingForDate(businessSlug, selection.slot.date, selection.courtId)
      .then((snapshot) => {
        if (cancelled) return;
        const withoutLights = snapshot.pricing.find((rule) => rule.lighting === "without_lights");
        const withLights = snapshot.pricing.find((rule) => rule.lighting === "with_lights");
        if (!withoutLights || !withLights) {
          setPricingError("No hay tarifas completas vigentes para la fecha seleccionada.");
          return;
        }
        setPricingRates({ withoutLights: withoutLights.hourlyRate, withLights: withLights.hourlyRate });
        setPricingCurrency(snapshot.currency);
      })
      .catch((caught) => {
        if (cancelled) return;
        setPricingError(caught instanceof Error ? caught.message : "No pudimos cargar la tarifa aplicable.");
      })
      .finally(() => {
        if (!cancelled) setPricingLoading(false);
      });

    return () => { cancelled = true; };
  }, [businessSlug, selection, repository]);

  if (!selection) {
    return <dialog ref={dialogRef} className="booking-dialog" aria-label="Solicitar reserva" />;
  }

  const effectiveEndTime = endOptions.some((option) => option.end === endTime)
    ? endTime
    : endOptions[0]?.end ?? selection.slot.end;
  const lighting = bookingLightingForInterval(selection.slot.start, effectiveEndTime);
  const preview = calculateBookingPreview(
    selection.slot.start,
    effectiveEndTime,
    lighting,
    pricingRates,
  );
  const demoMode = selection.source === "mock-provisional";
  const pricingReady = demoMode || (!pricingLoading && !pricingError);
  const requiresNetHeight = sportRequiresNetHeight(selection.sportSlug);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const currentSelection = selection;
    if (!currentSelection) return;
    if (!pricingReady) {
      setError(pricingError ?? "Espera mientras cargamos la tarifa aplicable.");
      return;
    }

    const normalizedName = normalizeCustomerName(name);
    const normalizedPhone = normalizePeruWhatsApp(phone);

    if (!isValidCustomerName(normalizedName)) {
      setError("Ingresa un nombre válido de 2 a 120 caracteres.");
      return;
    }
    if (!normalizedPhone) {
      setError("Ingresa un WhatsApp peruano válido, por ejemplo 935 059 868.");
      return;
    }
    if (!effectiveEndTime || !endOptions.some((option) => option.end === effectiveEndTime)) {
      setError("Selecciona una hora de fin válida y consecutiva.");
      return;
    }
    let parsedNetHeight: number | null = null;
    if (requiresNetHeight) {
      const preset = NET_HEIGHT_PRESETS.find((option) => option.id === netHeightPreset);
      const candidate = netHeightPreset === "custom"
        ? Number(customNetHeightCm)
        : preset?.cm;
      if (!isNetHeightCm(candidate)) {
        setError("Selecciona la altura de red para tu reserva.");
        return;
      }
      parsedNetHeight = candidate;
    }
    if (!demoMode && isPastLocalStart(currentSelection.slot.date, currentSelection.slot.start, currentSelection.timezone)) {
      setError("Ese horario ya pasó. Actualiza la disponibilidad y elige otro.");
      onAvailabilityStale();
      return;
    }

    setSubmitting(true);
    try {
      const nextResult = await repository.submit({
        businessSlug,
        courtId: currentSelection.courtId,
        date: currentSelection.slot.date,
        start: currentSelection.slot.start,
        end: effectiveEndTime,
        netHeightCm: parsedNetHeight,
        customerName: normalizedName,
        phoneE164: normalizedPhone,
        marketingOptIn,
        requestToken,
      });
      setResult(nextResult);
      if (nextResult.persisted) onPersisted();
    } catch (caught) {
      if (caught instanceof BookingRepositoryError) {
        setError(caught.message);
        if (caught.code === "slot_unavailable" || caught.code === "reservation_in_past") {
          onAvailabilityStale();
        }
      } else {
        setError("No pudimos enviar la solicitud. Inténtalo nuevamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    if (submitting) return;
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="booking-dialog"
      aria-labelledby="booking-title"
      onCancel={(event: SyntheticEvent<HTMLDialogElement>) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (selection) onClose();
      }}
    >
      <div className="booking-dialog__panel">
        <header className="booking-dialog__header">
          <div>
            <span className="eyebrow">SOLICITUD DE RESERVA</span>
            <h2 id="booking-title">Reserva tu horario</h2>
          </div>
          <button className="booking-dialog__close" type="button" onClick={close} aria-label="Cerrar">×</button>
        </header>

        {result ? (
          <div className="booking-result" aria-live="polite">
            <span className={`booking-result__icon ${result.persisted ? "booking-result__icon--success" : ""}`} aria-hidden="true">
              {result.persisted ? "✓" : "i"}
            </span>
            <h3>{result.persisted ? "Solicitud recibida" : "Solicitud no enviada"}</h3>
            {result.persisted ? (
              <>
                <p>Tu solicitud quedó <strong>pendiente de aprobación del propietario</strong>. No es todavía una reserva confirmada.</p>
                <p>Mientras está pendiente, el intervalo queda ocupado para evitar que dos personas soliciten la misma cancha al mismo tiempo.</p>
                <dl className="booking-summary booking-summary--success">
                  <div><dt>Estado</dt><dd>Pendiente</dd></div>
                  {result.netHeightCm !== null ? <div><dt>Altura de red</dt><dd>{netHeightLabel(result.netHeightCm)}</dd></div> : null}
                  <div><dt>Iluminación</dt><dd>{result.lighting === "with_lights" ? "Con luz" : "Sin luz"}</dd></div>
                  <div><dt>Tarifa validada por servidor</dt><dd>{formatMoney(result.hourlyRate, result.currency)}/h</dd></div>
                  <div><dt>Total validado por servidor</dt><dd>{formatMoney(result.totalAmount, result.currency)}</dd></div>
                </dl>
                {paymentMethods.length > 0 ? (
                  <div className="booking-payment-options">
                    <strong>Opciones de pago manual</strong>
                    <p>Reportar un pago no lo confirma automáticamente. El negocio debe verificarlo.</p>
                    <div>
                      {paymentMethods.map((method) => (
                        <article key={method.method}>
                          <b>{method.label}</b>
                          {method.destination ? <span>{method.destination}</span> : null}
                          {method.instructions ? <small>{method.instructions}</small> : null}
                        </article>
                      ))}
                    </div>
                    <a className="text-link" href="/mi-cuenta">Ir a Mi cuenta para reportar el pago →</a>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p><strong>La reserva en línea no está disponible en este momento.</strong></p>
                <p>Consulta el horario por WhatsApp o teléfono antes de acercarte.</p>
              </>
            )}
            <button className="button button--primary button--full" type="button" onClick={close}>Entendido</button>
          </div>
        ) : (
          <form className="booking-form" onSubmit={submit} noValidate>
            <div className={`booking-source-note ${demoMode ? "booking-source-note--demo" : ""}`} role="note">
              <strong>{demoMode ? "Reserva en línea temporalmente no disponible" : "Solicitud sujeta a confirmación"}</strong>
              <span>{selection.scheduleIsProvisional ? "Algunos horarios pueden requerir confirmación antes de reservar." : "El horario seleccionado se verificará al enviar tu solicitud."}</span>
            </div>

            <dl className="booking-summary">
              <div><dt>Cancha</dt><dd>{selection.courtName}</dd></div>
              <div><dt>Fecha</dt><dd>{formatLocalDate(selection.slot.date)}</dd></div>
              <div><dt>Inicio</dt><dd>{selection.slot.start}</dd></div>
            </dl>

            <label className="field" htmlFor="booking-end">
              <span className="field__label">Hora de fin</span>
              <select
                className="field__control"
                id="booking-end"
                value={effectiveEndTime}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => setEndTime(event.target.value)}
                required
              >
                {endOptions.map((option) => (
                  <option value={option.end} key={option.end}>{option.label}</option>
                ))}
              </select>
              <span className="field__hint">Solo se ofrecen bloques consecutivos que actualmente aparecen disponibles.</span>
            </label>

            <fieldset className="lighting-picker">
              <legend>Iluminación automática</legend>
              <div className="lighting-option lighting-option--selected">
                <span>
                  <strong>{lighting === "with_lights" ? "Con luz" : "Sin luz"}</strong>
                  <small>
                    {pricingLoading
                      ? "Consultando tarifa…"
                      : pricingError
                        ? "Tarifa por confirmar"
                        : `${formatMoney(lighting === "with_lights" ? pricingRates.withLights : pricingRates.withoutLights, pricingCurrency)} por hora`}
                  </small>
                </span>
              </div>
              <small className="field__hint">De 07:00 a 17:59 se reserva sin luz; desde las 18:00, con luz. Un mismo bloque no puede cruzar las 18:00.</small>
            </fieldset>

            <div className="booking-fields">
              {requiresNetHeight ? <label className="field" htmlFor="booking-net-height">
                <span className="field__label">Altura de red</span>
                <select
                  className="field__control"
                  id="booking-net-height"
                  value={netHeightPreset}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => setNetHeightPreset(event.target.value)}
                  required
                >
                  <option value="">Selecciona una altura</option>
                  {NET_HEIGHT_PRESETS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                  <option value="custom">Personalizada · 1.80 m a 2.50 m</option>
                </select>
              </label> : null}
              {requiresNetHeight && netHeightPreset === "custom" ? (
                <label className="field" htmlFor="booking-net-height-custom">
                  <span className="field__label">Altura personalizada (cm)</span>
                  <input
                    className="field__control"
                    id="booking-net-height-custom"
                    type="number"
                    min={180}
                    max={250}
                    step={1}
                    inputMode="numeric"
                    value={customNetHeightCm}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomNetHeightCm(event.target.value)}
                    required
                  />
                </label>
              ) : null}
              <label className="field" htmlFor="booking-name">
                <span className="field__label">Nombre</span>
                <input
                  className="field__control"
                  id="booking-name"
                  name="name"
                  autoComplete="name"
                  maxLength={120}
                  value={name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
                  placeholder="Tu nombre"
                  required
                />
              </label>
              <label className="field" htmlFor="booking-phone">
                <span className="field__label">WhatsApp</span>
                <input
                  className="field__control"
                  id="booking-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPhone(event.target.value)}
                  placeholder="935 059 868"
                  required
                />
                <span className="field__hint">Se normaliza a formato internacional (+51…). El teléfono nunca se publica en el calendario.</span>
              </label>
            </div>

            <label className="consent-row">
              <input type="checkbox" checked={marketingOptIn} onChange={(event: ChangeEvent<HTMLInputElement>) => setMarketingOptIn(event.target.checked)} />
              <span>Quiero recibir promociones y avisos de horarios disponibles por WhatsApp. <strong>Opcional.</strong></span>
            </label>

            <div className="booking-quote" aria-live="polite">
              <div><span>Duración</span><strong>{preview.durationHours} h</strong></div>
              <div><span>Tarifa</span><strong>{pricingReady ? `${formatMoney(preview.hourlyRate, pricingCurrency)}/h` : "—"}</strong></div>
              <div className="booking-quote__total"><span>Total estimado</span><strong>{pricingReady ? formatMoney(preview.total, pricingCurrency) : "—"}</strong></div>
              {!demoMode ? <small>La tarifa y el total se confirman al enviar la solicitud.</small> : null}
            </div>

            {pricingError ? <div className="booking-error" role="alert">{pricingError}</div> : null}
            {error ? <div className="booking-error" role="alert">{error}</div> : null}

            <button className="button button--primary button--full" type="submit" disabled={submitting || demoMode || endOptions.length === 0 || !pricingReady}>
              {submitting ? "Validando disponibilidad…" : demoMode ? "Reserva en línea no disponible" : "Solicitar reserva"}
            </button>
            <p className="booking-policy">Tu solicitud queda <strong>Pendiente</strong> hasta que el negocio la confirme.</p>
          </form>
        )}
      </div>
    </dialog>
  );
}
