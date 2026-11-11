"use client";

import { useEffect, useState } from "react";
import type { AdminBusinessStructure } from "@/lib/admin/inventory";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export function AdminCourtSportSettings({ courtId, primarySportId, sports, canManage, onSaved }: {
  courtId: string;
  primarySportId: string;
  sports: AdminBusinessStructure["sports"];
  canManage: boolean;
  onSaved: () => void;
}) {
  const [additional, setAdditional] = useState<string[]>([]);
  const [showcase, setShowcase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedCourtId, setLoadedCourtId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    setLoading(true);
    setLoadedCourtId(null);
    setLoadFailed(false);
    setMessage(null);
    void (async () => {
      try {
        const { data, error } = await createPublicBrowserSupabaseClient().rpc("admin_get_court_sport_settings", { p_court_id: courtId });
        if (cancelled) return;
        if (error) {
          setLoadFailed(true);
          return;
        }
        setAdditional((data ?? []).flatMap((row) => row.sport_id ? [row.sport_id] : []));
        setShowcase(data?.[0]?.showcase_visible === true);
        setLoadedCourtId(courtId);
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canManage, courtId, retryNonce]);

  async function save() {
    if (!canManage || busy || loading || loadFailed || loadedCourtId !== courtId) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("admin_update_court_sport_settings", {
        p_court_id: courtId,
        p_sport_ids: additional,
        p_visible: showcase,
      });
      if (error) {
        setMessage({ text: "No se pudo guardar. Revisa los deportes seleccionados e inténtalo otra vez.", error: true });
        return;
      }
      setMessage({ text: "Deportes y visibilidad del campo guardados.", error: false });
      onSaved();
    } catch {
      setMessage({ text: "No se pudo conectar con la administración del campo.", error: true });
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) return null;
  if (loading || (loadedCourtId !== courtId && !loadFailed)) return <p className="admin-court-sports__help">Cargando deportes disponibles…</p>;
  if (loadFailed || loadedCourtId !== courtId) return <section className="admin-court-sports" aria-label="Deportes y visibilidad del campo">
    <p role="alert" className="admin-structure-message--error">No pudimos cargar los deportes de este campo. Por seguridad no se pueden guardar cambios hasta recuperar su configuración actual.</p>
    <button type="button" className="button button--secondary" onClick={() => setRetryNonce((current) => current + 1)}>Reintentar carga</button>
  </section>;
  return <section className="admin-court-sports" aria-label="Deportes y visibilidad del campo">
    <div><strong>Deportes admitidos en este campo</strong>
      <p className="admin-court-sports__help">Un campo físico puede recibir fútbol y vóley, pero siempre comparte una sola agenda. No se duplica ninguna reserva.</p>
    </div>
    <div className="admin-court-sports__options">
      {sports.map((sport) => {
        const isPrimary = sport.sportId === primarySportId;
        return <label key={sport.sportId}>
          <input type="checkbox" checked={isPrimary || additional.includes(sport.sportId)}
            disabled={isPrimary || !canManage || busy}
            onChange={(event) => setAdditional((current) => event.target.checked
              ? [...current, sport.sportId] : current.filter((id) => id !== sport.sportId))} />
          <span>{sport.name}{isPrimary ? " · deporte principal" : ""}</span>
        </label>;
      })}
    </div>
    <label className="admin-court-sports__visibility">
      <input type="checkbox" checked={showcase} disabled={!canManage || busy}
        onChange={(event) => setShowcase(event.target.checked)} />
      <span>Mostrar este campo en la página pública, aunque sus horarios y tarifas aún estén pendientes. Sin configuración operativa no se habilitan reservas.</span>
    </label>
    {canManage ? <button type="button" className="button button--secondary" onClick={() => void save()} disabled={busy}>
      {busy ? "Guardando…" : "Guardar deportes y visibilidad"}
    </button> : null}
    {message ? <p role={message.error ? "alert" : "status"} className={message.error ? "admin-structure-message--error" : "admin-structure-message"}>{message.text}</p> : null}
  </section>;
}
