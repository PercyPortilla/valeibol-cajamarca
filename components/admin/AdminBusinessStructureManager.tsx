"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { AdminCourtHoursEditor } from "@/components/admin/AdminCourtHoursEditor";
import type { AdminBusinessStructure, AdminInventoryCourt, AdminInventoryVenue } from "@/lib/admin/inventory";
import type { Json } from "@/lib/data/supabase/database.types";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

const week = [
  [1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"],
  [5, "Viernes"], [6, "Sábado"], [7, "Domingo"],
] as const;

const bookingIncrementOptions = Array.from({ length: 226 }, (_, index) => index + 15)
  .filter((minutes) => 1440 % minutes === 0 && minutes <= 240);

type DayHours = { weekday: number; isOpen: boolean; opensAt: string; closesAt: string };
type Feedback = { kind: "success" | "error"; message: string } | null;

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <span className={`admin-structure-message ${feedback.kind === "error" ? "admin-structure-message--error" : ""}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</span>;
}

function mutationMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("publication_requires_active_venue")) return "Necesitas al menos una sede activa antes de publicar.";
  if (normalized.includes("publication_requires_active_court")) return "Necesitas al menos una cancha activa antes de publicar.";
  if (normalized.includes("publication_requires_ready_courts")) return "Todas las canchas activas deben tener sede y deporte activos, horario semanal confirmado y ambas tarifas vigentes.";
  if (normalized.includes("published_business_requires_ready_court")) return "No puedes desactivar la última cancha operativa mientras el negocio está publicado. Retíralo de publicación o deja otra cancha lista.";
  if (normalized.includes("court_hours_not_ready")) return "La cancha necesita un horario semanal confirmado con al menos un día abierto antes de activarse.";
  if (normalized.includes("court_pricing_not_ready")) return "La cancha necesita ambas tarifas vigentes y confirmadas antes de activarse.";
  if (normalized.includes("business_not_published")) return "El negocio todavía no está publicado.";
  if (normalized.includes("booking_increment_conflict_future_reservations")) return "No puedes usar ese intervalo porque una reserva futura pendiente o confirmada quedaría fuera de la nueva cuadrícula.";
  if (normalized.includes("booking_increment_conflict_future_blocks")) return "No puedes usar ese intervalo porque un bloqueo futuro activo quedaría fuera de la nueva cuadrícula.";
  if (normalized.includes("invalid_booking_increment")) return "Elige un intervalo válido entre 15 y 240 minutos que divida exactamente un día.";
  if (normalized.includes("court_has_future_reservations")) return "No puedes desactivar esta cancha mientras tenga reservas futuras pendientes o confirmadas.";
  if (normalized.includes("venue_has_active_courts")) return "Desactiva primero las canchas activas de esta sede.";
  if (normalized.includes("duplicate") || normalized.includes("unique")) return "Ese slug ya existe dentro del negocio.";
  if (normalized.includes("invalid_")) return "Revisa los datos ingresados.";
  return "No pudimos guardar el cambio.";
}

function VenueEditor({ venue, canManage, onSaved }: { venue: AdminInventoryVenue; canManage: boolean; onSaved: () => void }) {
  const [name, setName] = useState(venue.name);
  const [city, setCity] = useState(venue.city ?? "");
  const [address, setAddress] = useState(venue.address ?? "");
  const [latitude, setLatitude] = useState(venue.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(venue.longitude?.toString() ?? "");
  const [active, setActive] = useState(venue.isActive);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function save() {
    if (!canManage || busy) return;
    setBusy(true); setFeedback(null);
    const { error } = await createPublicBrowserSupabaseClient().rpc("admin_update_venue", {
      p_venue_id: venue.venueId,
      p_name: name,
      p_city: city || null,
      p_address: address || null,
      p_latitude: latitude ? Number(latitude) : null,
      p_longitude: longitude ? Number(longitude) : null,
      p_active: active,
    });
    if (error) { setActive(venue.isActive); setFeedback({ kind: "error", message: mutationMessage(error.message) }); }
    else { setFeedback({ kind: "success", message: "Sede actualizada." }); onSaved(); }
    setBusy(false);
  }

  return (
    <article className="admin-structure-item">
      <div className="admin-structure-item__head"><div><strong>{venue.name}</strong><small>{venue.slug}</small></div><Badge tone={venue.isActive ? "success" : "neutral"}>{venue.isActive ? "Activa" : "Inactiva"}</Badge></div>
      <div className="admin-structure-form-grid">
        <Input label="Nombre" name={`venue-name-${venue.venueId}`} value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
        <Input label="Ciudad" name={`venue-city-${venue.venueId}`} value={city} disabled={!canManage} onChange={(e) => setCity(e.target.value)} />
        <Input label="Dirección" name={`venue-address-${venue.venueId}`} value={address} disabled={!canManage} onChange={(e) => setAddress(e.target.value)} />
        <Input label="Latitud" name={`venue-lat-${venue.venueId}`} type="number" step="0.000001" value={latitude} disabled={!canManage} onChange={(e) => setLatitude(e.target.value)} />
        <Input label="Longitud" name={`venue-lng-${venue.venueId}`} type="number" step="0.000001" value={longitude} disabled={!canManage} onChange={(e) => setLongitude(e.target.value)} />
        <label className="admin-access-toggle"><input type="checkbox" checked={active} disabled={!canManage} onChange={(e) => setActive(e.target.checked)} /><span>Sede activa</span></label>
      </div>
      {canManage ? <Button type="button" variant="secondary" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar sede"}</Button> : null}
      <FeedbackMessage feedback={feedback} />
    </article>
  );
}

function CourtEditor({ court, businessToday, canManage, onSaved }: { court: AdminInventoryCourt; businessToday: string; canManage: boolean; onSaved: () => void }) {
  const [name, setName] = useState(court.name);
  const [surface, setSurface] = useState(court.surface ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function saveIdentity() {
    if (!canManage || busy) return;
    setBusy(true); setFeedback(null);
    const { error } = await createPublicBrowserSupabaseClient().rpc("admin_update_court_identity", { p_court_id: court.courtId, p_name: name, p_surface: surface || null });
    if (error) setFeedback({ kind: "error", message: mutationMessage(error.message) });
    else { setFeedback({ kind: "success", message: "Cancha actualizada." }); onSaved(); }
    setBusy(false);
  }

  async function toggle() {
    if (!canManage || busy) return;
    if (court.isActive && !window.confirm(`¿Desactivar ${court.name}? No se permitirá si tiene reservas futuras activas.`)) return;
    setBusy(true); setFeedback(null);
    const { error } = await createPublicBrowserSupabaseClient().rpc("admin_set_court_active", { p_court_id: court.courtId, p_active: !court.isActive });
    if (error) setFeedback({ kind: "error", message: mutationMessage(error.message) });
    else { setFeedback({ kind: "success", message: `Cancha ${court.isActive ? "desactivada" : "activada"}.` }); onSaved(); }
    setBusy(false);
  }

  return (
    <article className="admin-court-item">
      <div className="admin-structure-item__head"><div><strong>{court.name}</strong><small>{court.sportName} · {court.slug}</small></div><Badge tone={court.isActive ? "success" : "neutral"}>{court.isActive ? "Activa" : "Inactiva"}</Badge></div>
      <div className="admin-structure-readiness"><span>{court.hoursConfigured ? "✓ Horario" : "⚠ Sin horario"}</span><span>{court.pricingConfigured ? "✓ Tarifas" : "⚠ Sin tarifas"}</span></div>
      <div className="admin-structure-form-grid admin-structure-form-grid--compact">
        <Input label="Nombre" name={`court-name-${court.courtId}`} value={name} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
        <Input label="Superficie" name={`court-surface-${court.courtId}`} value={surface} disabled={!canManage} onChange={(e) => setSurface(e.target.value)} />
      </div>
      {canManage ? <div className="admin-structure-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => void saveIdentity()}>Guardar datos</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => void toggle()}>{court.isActive ? "Desactivar" : "Activar"}</Button></div> : null}
      <FeedbackMessage feedback={feedback} />
      <AdminCourtHoursEditor court={court} businessToday={businessToday} canManage={canManage} onSaved={onSaved} />
    </article>
  );
}

export function AdminBusinessStructureManager({ structure, businessToday, canManage, localMode }: { structure: AdminBusinessStructure; businessToday: string; canManage: boolean; localMode: boolean }) {
  const router = useRouter();
  const [businessFeedback, setBusinessFeedback] = useState<Feedback>(null);
  const [venueCreateFeedback, setVenueCreateFeedback] = useState<Feedback>(null);
  const [courtCreateFeedback, setCourtCreateFeedback] = useState<Feedback>(null);
  const [businessBusy, setBusinessBusy] = useState(false);
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [publicationFeedback, setPublicationFeedback] = useState<Feedback>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingIncrement, setBookingIncrement] = useState(String(structure.bookingIncrementMinutes));
  const [bookingFeedback, setBookingFeedback] = useState<Feedback>(null);
  const [venueCreateBusy, setVenueCreateBusy] = useState(false);
  const [courtCreateBusy, setCourtCreateBusy] = useState(false);
  const [hours, setHours] = useState<DayHours[]>(week.map(([weekday]) => ({ weekday, isOpen: false, opensAt: "08:00", closesAt: "22:00" })));
  const refresh = () => router.refresh();

  useEffect(() => {
    setBookingIncrement(String(structure.bookingIncrementMinutes));
  }, [structure.bookingIncrementMinutes]);

  async function updateBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canManage || localMode || businessBusy) return;
    const form = new FormData(event.currentTarget); setBusinessBusy(true); setBusinessFeedback(null);
    const { error } = await createPublicBrowserSupabaseClient().rpc("admin_update_business_profile", {
      p_name: String(form.get("name") ?? ""), p_city: String(form.get("city") ?? "") || null,
      p_country: String(form.get("country") ?? "") || null, p_address: String(form.get("address") ?? "") || null,
      p_phone: String(form.get("phone") ?? "") || null,
    });
    if (error) setBusinessFeedback({ kind: "error", message: mutationMessage(error.message) }); else { setBusinessFeedback({ kind: "success", message: "Datos públicos actualizados." }); refresh(); }
    setBusinessBusy(false);
  }

  async function createVenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canManage || localMode || venueCreateBusy) return;
    const formElement = event.currentTarget; const form = new FormData(formElement); setVenueCreateFeedback(null);
    setVenueCreateBusy(true);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("admin_create_venue", {
        p_slug: String(form.get("slug") ?? ""), p_name: String(form.get("name") ?? ""),
        p_city: String(form.get("city") ?? "") || null, p_address: String(form.get("address") ?? "") || null,
        p_latitude: form.get("latitude") ? Number(form.get("latitude")) : null,
        p_longitude: form.get("longitude") ? Number(form.get("longitude")) : null,
      });
      setVenueCreateFeedback(error ? { kind: "error", message: mutationMessage(error.message) } : { kind: "success", message: "Sede creada." });
      if (!error) { formElement.reset(); refresh(); }
    } finally {
      setVenueCreateBusy(false);
    }
  }

  async function updateBookingIncrement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || localMode || bookingBusy) return;
    const next = Number(bookingIncrement);
    setBookingBusy(true);
    setBookingFeedback(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("admin_update_booking_increment", {
        p_booking_increment_minutes: next,
      });
      if (error) {
        setBookingFeedback({ kind: "error", message: mutationMessage(error.message) });
        return;
      }
      setBookingFeedback({ kind: "success", message: `Intervalo de reserva actualizado a ${next} minutos.` });
      refresh();
    } finally {
      setBookingBusy(false);
    }
  }

  async function updatePublication(nextStatus: "provisional" | "confirmed") {
    if (!canManage || localMode || publicationBusy || nextStatus === structure.configurationStatus) return;
    if (nextStatus === "provisional" && !window.confirm("¿Retirar este negocio de publicación? Dejará de aparecer en el marketplace y no aceptará nuevas reservas públicas; las reservas existentes se conservan.")) return;
    setPublicationBusy(true);
    setPublicationFeedback(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("admin_set_business_configuration_status", { p_status: nextStatus });
      if (error) {
        setPublicationFeedback({ kind: "error", message: mutationMessage(error.message) });
        return;
      }
      setPublicationFeedback({
        kind: "success",
        message: nextStatus === "confirmed" ? "Negocio publicado. Ya puede aparecer y recibir nuevas reservas públicas." : "Negocio retirado de publicación. Las reservas existentes se conservan.",
      });
      refresh();
    } finally {
      setPublicationBusy(false);
    }
  }

  async function createCourt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canManage || localMode || courtCreateBusy) return;
    const formElement = event.currentTarget; const form = new FormData(formElement); setCourtCreateFeedback(null);
    if (!hours.some((day) => day.isOpen)) { setCourtCreateFeedback({ kind: "error", message: "Marca al menos un día abierto para crear la cancha." }); return; }
    const payload = hours.map((day) => ({ weekday: day.weekday, is_open: day.isOpen, opens_at: day.isOpen ? day.opensAt : null, closes_at: day.isOpen ? day.closesAt : null })) as unknown as Json;
    setCourtCreateBusy(true);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("admin_create_court", {
        p_venue_id: String(form.get("venueId") ?? ""), p_sport_id: String(form.get("sportId") ?? ""),
        p_slug: String(form.get("slug") ?? ""), p_name: String(form.get("name") ?? ""), p_surface: String(form.get("surface") ?? "") || null,
        p_hours: payload, p_rate_without_lights: Number(form.get("rateWithout")), p_rate_with_lights: Number(form.get("rateWith")),
      });
      setCourtCreateFeedback(error ? { kind: "error", message: mutationMessage(error.message) } : { kind: "success", message: "Cancha creada con horario y tarifas iniciales." });
      if (!error) { formElement.reset(); setHours(week.map(([weekday]) => ({ weekday, isOpen: false, opensAt: "08:00", closesAt: "22:00" }))); refresh(); }
    } finally {
      setCourtCreateBusy(false);
    }
  }

  return (
    <div className="admin-structure-stack">
      {localMode ? <div className="auth-notice" role="status">Modo local: esta pantalla muestra la estructura demo en solo lectura. Las altas reales requieren Supabase configurado.</div> : null}
      <section className="admin-structure-card" aria-labelledby="business-profile-title">
        <div className="admin-content-editor__head"><div><span className="metric-label">NEGOCIO</span><h2 id="business-profile-title">Datos públicos</h2><p>Slug, moneda y zona horaria se conservan estables desde el alta global.</p></div><Badge tone={structure.configurationStatus === "confirmed" ? "success" : "warning"}>{structure.configurationStatus === "confirmed" ? "Confirmado" : "Provisional"}</Badge></div>
        <dl className="phase7-rule-meta"><div><dt>Slug</dt><dd>{structure.slug}</dd></div><div><dt>Moneda</dt><dd>{structure.currency}</dd></div><div><dt>Zona horaria</dt><dd>{structure.timezone}</dd></div><div><dt>Intervalo de reserva</dt><dd>{structure.bookingIncrementMinutes} min</dd></div></dl>
        <form className="admin-structure-form-grid" onSubmit={updateBusiness}>
          <Input id="business-name" label="Nombre" name="name" defaultValue={structure.name} disabled={!canManage || localMode} required />
          <Input id="business-city" label="Ciudad" name="city" defaultValue={structure.city ?? ""} disabled={!canManage || localMode} />
          <Input id="business-country" label="País" name="country" defaultValue={structure.country ?? ""} disabled={!canManage || localMode} />
          <Input id="business-address" label="Dirección" name="address" defaultValue={structure.address ?? ""} disabled={!canManage || localMode} />
          <Input id="business-phone" label="Teléfono público" name="phone" defaultValue={structure.phone ?? ""} disabled={!canManage || localMode} />
          {canManage && !localMode ? <Button type="submit" disabled={businessBusy}>{businessBusy ? "Guardando…" : "Guardar negocio"}</Button> : null}
        </form>
        <FeedbackMessage feedback={businessFeedback} />
        <div className="admin-publication-control" aria-labelledby="publication-title">
          <div>
            <strong id="publication-title">Publicación del negocio</strong>
            <p>{structure.configurationStatus === "confirmed" ? "Publicado: el negocio puede aparecer en el marketplace y aceptar nuevas reservas." : "En preparación: el negocio sigue administrable, pero no aparece ni acepta nuevas reservas públicas."}</p>
          </div>
          <ul className="admin-publication-checklist">
            <li>{structure.publicationReadiness.hasActiveVenue ? "✓" : "○"} Al menos una sede activa</li>
            <li>{structure.publicationReadiness.hasActiveCourt ? "✓" : "○"} Al menos una cancha activa</li>
            <li>{structure.publicationReadiness.activeCourtsReady ? "✓" : "○"} Canchas activas listas: horario semanal y tarifas vigentes</li>
          </ul>
          <small>{structure.publicationReadiness.activeCourtCount} cancha{structure.publicationReadiness.activeCourtCount === 1 ? "" : "s"} activa{structure.publicationReadiness.activeCourtCount === 1 ? "" : "s"} evaluada{structure.publicationReadiness.activeCourtCount === 1 ? "" : "s"}.</small>
          {canManage && !localMode ? (
            <div className="admin-publication-control__actions">
              {structure.configurationStatus === "provisional" ? (
                <Button type="button" disabled={publicationBusy || !structure.publicationReadiness.hasActiveVenue || !structure.publicationReadiness.hasActiveCourt || !structure.publicationReadiness.activeCourtsReady} onClick={() => void updatePublication("confirmed")}>
                  {publicationBusy ? "Publicando…" : "Publicar negocio"}
                </Button>
              ) : (
                <Button type="button" variant="secondary" disabled={publicationBusy} onClick={() => void updatePublication("provisional")}>
                  {publicationBusy ? "Retirando…" : "Retirar de publicación"}
                </Button>
              )}
            </div>
          ) : null}
          <FeedbackMessage feedback={publicationFeedback} />
        </div>
        {canManage && !localMode ? (
          <form className="admin-booking-setting" onSubmit={updateBookingIncrement}>
            <div>
              <strong>Granularidad de la agenda</strong>
              <p>Define el tamaño de los bloques que ve el cliente. No se guardará un cambio que vuelva incompatibles reservas o bloqueos futuros.</p>
            </div>
            <label className="field">
              <span className="field__label">Intervalo de reserva</span>
              <select className="field__control" value={bookingIncrement} disabled={bookingBusy} onChange={(event) => setBookingIncrement(event.target.value)}>
                {bookingIncrementOptions.map((minutes) => <option key={minutes} value={minutes}>Cada {minutes} min</option>)}
              </select>
            </label>
            <Button type="submit" variant="secondary" disabled={bookingBusy || Number(bookingIncrement) === structure.bookingIncrementMinutes}>
              {bookingBusy ? "Actualizando…" : "Actualizar intervalo"}
            </Button>
            <FeedbackMessage feedback={bookingFeedback} />
          </form>
        ) : null}
      </section>

      <section className="admin-structure-card" aria-labelledby="venues-title">
        <div className="admin-content-editor__head"><div><span className="metric-label">SEDES</span><h2 id="venues-title">Sedes físicas</h2><p>Las coordenadas son opcionales y nunca se geocodifican automáticamente.</p></div><span>{structure.venues.length} registradas</span></div>
        <div className="admin-structure-list">{structure.venues.map((venue) => <VenueEditor key={venue.venueId} venue={venue} canManage={canManage && !localMode} onSaved={refresh} />)}</div>
        {canManage && !localMode ? <form className="admin-structure-create" onSubmit={createVenue}><h3>Añadir sede</h3><div className="admin-structure-form-grid"><Input id="new-venue-name" label="Nombre" name="name" required disabled={venueCreateBusy} /><Input id="new-venue-slug" label="Slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" disabled={venueCreateBusy} /><Input id="new-venue-city" label="Ciudad" name="city" disabled={venueCreateBusy} /><Input id="new-venue-address" label="Dirección" name="address" disabled={venueCreateBusy} /><Input id="new-venue-latitude" label="Latitud" name="latitude" type="number" min="-90" max="90" step="0.000001" disabled={venueCreateBusy} /><Input id="new-venue-longitude" label="Longitud" name="longitude" type="number" min="-180" max="180" step="0.000001" disabled={venueCreateBusy} /></div><Button type="submit" disabled={venueCreateBusy}>{venueCreateBusy ? "Creando…" : "Crear sede"}</Button><FeedbackMessage feedback={venueCreateFeedback} /></form> : null}
      </section>

      <section className="admin-structure-card" aria-labelledby="courts-title">
        <div className="admin-content-editor__head"><div><span className="metric-label">CANCHAS</span><h2 id="courts-title">Inventario deportivo</h2><p>Las canchas nuevas se crean con horario y tarifas reales en una sola operación.</p></div></div>
        <div className="admin-structure-list">{structure.venues.flatMap((venue) => venue.courts.map((court) => <CourtEditor key={court.courtId} court={court} businessToday={businessToday} canManage={canManage && !localMode} onSaved={refresh} />))}</div>
        {canManage && !localMode && structure.venues.some((venue) => venue.isActive) ? (
          <form className="admin-structure-create" onSubmit={createCourt}>
            <h3>Añadir cancha</h3>
            <div className="admin-structure-form-grid">
              <Select id="new-court-venue" label="Sede" name="venueId" options={structure.venues.filter((v) => v.isActive).map((v) => ({ value: v.venueId, label: v.name }))} />
              <Select id="new-court-sport" label="Deporte" name="sportId" options={structure.sports.map((sport) => ({ value: sport.sportId, label: sport.name }))} />
              <Input id="new-court-name" label="Nombre" name="name" required /><Input id="new-court-slug" label="Slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /><Input id="new-court-surface" label="Superficie" name="surface" />
              <Input id="new-court-rate-without" label={`Tarifa sin luz (${structure.currency}/h)`} name="rateWithout" type="number" min="0.01" max="10000" step="0.01" required />
              <Input id="new-court-rate-with" label={`Tarifa con luz (${structure.currency}/h)`} name="rateWith" type="number" min="0.01" max="10000" step="0.01" required />
            </div>
            <fieldset className="admin-weekly-hours"><legend>Horario semanal inicial</legend>{week.map(([weekday, label], index) => { const day = hours[index]; return <div className="admin-weekly-hours__row" key={weekday}><label className="admin-access-toggle"><input type="checkbox" checked={day.isOpen} onChange={(e) => setHours((current) => current.map((item, i) => i === index ? { ...item, isOpen: e.target.checked } : item))} /><span>{label}</span></label><input aria-label={`Apertura ${label}`} className="field__control" type="time" disabled={!day.isOpen} value={day.opensAt} onChange={(e) => setHours((current) => current.map((item, i) => i === index ? { ...item, opensAt: e.target.value } : item))} /><input aria-label={`Cierre ${label}`} className="field__control" type="time" disabled={!day.isOpen} value={day.closesAt} onChange={(e) => setHours((current) => current.map((item, i) => i === index ? { ...item, closesAt: e.target.value } : item))} /></div>; })}</fieldset>
            <Button type="submit" disabled={courtCreateBusy}>{courtCreateBusy ? "Creando…" : "Crear cancha operativa"}</Button>
            <FeedbackMessage feedback={courtCreateFeedback} />
          </form>
        ) : canManage && !localMode ? <div className="state-box">Crea o activa una sede antes de añadir canchas.</div> : null}
      </section>
    </div>
  );
}
