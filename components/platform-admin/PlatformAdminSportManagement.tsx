"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";

export type PlatformAdminSport = {
  sportId: string;
  slug: string;
  name: string;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  activeCourtCount: number;
  courtCount: number;
};

function sportError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("sport_has_active_courts")) return "No puedes desactivar este deporte mientras tenga canchas activas.";
  if (normalized.includes("sport_slug_taken") || normalized.includes("duplicate") || normalized.includes("unique")) return "Ese slug ya está en uso por otro deporte.";
  if (normalized.includes("invalid_sport_slug")) return "El slug solo puede usar minúsculas, números y guiones.";
  if (normalized.includes("invalid_sport_name")) return "El nombre del deporte no es válido.";
  if (normalized.includes("invalid_sport_sort_order")) return "El orden debe ser un número válido mayor o igual a 0.";
  return "No pudimos actualizar el catálogo de deportes.";
}

export function PlatformAdminSportManagement({ sports, loadFailed = false }: { sports: PlatformAdminSport[]; loadFailed?: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  async function save(event: FormEvent<HTMLFormElement>, sport?: PlatformAdminSport) {
    event.preventDefault();
    if (busyId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const key = sport?.sportId ?? "new";
    setBusyId(key);
    setFeedback(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("platform_admin_upsert_sport", {
        p_sport_id: sport?.sportId ?? null,
        p_slug: String(form.get("slug") ?? "").trim().toLowerCase(),
        p_name: String(form.get("name") ?? "").trim(),
        p_icon: String(form.get("icon") ?? "").trim() || null,
        p_sort_order: Number(form.get("sortOrder") ?? 0),
      });
      if (error) {
        setFeedback({ kind: "error", message: sportError(error.message) });
        return;
      }
      setFeedback({ kind: "success", message: sport ? `${sport.name} fue actualizado.` : "Deporte creado y publicado en el catálogo." });
      if (!sport) formElement.reset();
      setEditingId(null);
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "No pudimos conectar con la administración global." });
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(sport: PlatformAdminSport) {
    if (busyId) return;
    const next = !sport.isActive;
    if (!next && !window.confirm(`¿Desactivar ${sport.name}? Dejará de mostrarse como deporte disponible.`)) return;
    setBusyId(sport.sportId);
    setFeedback(null);
    try {
      const { error } = await createPublicBrowserSupabaseClient().rpc("platform_admin_set_sport_active", {
        p_sport_id: sport.sportId,
        p_active: next,
      });
      if (error) {
        setFeedback({ kind: "error", message: sportError(error.message) });
        return;
      }
      setFeedback({ kind: "success", message: `${sport.name} quedó ${next ? "activo" : "inactivo"}.` });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="global-admin-board global-admin-sports" aria-labelledby="global-sports-title">
      <div className="global-admin-board__heading">
        <div><span className="eyebrow">CATÁLOGO DEPORTIVO</span><h2 id="global-sports-title">Deportes de la plataforma</h2></div>
        <span>{sports.length} registrados</span>
      </div>
      <p className="global-admin-footnote">Los deportes son globales. Los propietarios pueden asignar a sus canchas cualquier deporte activo, pero solo el ADMIN global puede crear o desactivar categorías.</p>
      {loadFailed ? <div className="auth-error" role="alert">No pudimos cargar el catálogo de deportes.</div> : null}
      {feedback ? <div className={feedback.kind === "error" ? "auth-error" : "global-admin-notice"} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</div> : null}

      <div className="global-admin-sport-list">
        {sports.map((sport) => (
          <article className="global-admin-sport-row" key={sport.sportId}>
            <div>
              <span className={sport.isActive ? "global-admin-state global-admin-state--active" : "global-admin-state"}>{sport.isActive ? "Activo" : "Inactivo"}</span>
              <strong>{sport.name}</strong>
              <small>{sport.slug} · {sport.activeCourtCount} activas / {sport.courtCount} canchas</small>
            </div>
            <div className="global-admin-business-row__actions">
              <Button type="button" variant="secondary" disabled={Boolean(busyId)} onClick={() => setEditingId((current) => current === sport.sportId ? null : sport.sportId)}>{editingId === sport.sportId ? "Cerrar edición" : "Editar"}</Button>
              <Button type="button" variant="ghost" disabled={Boolean(busyId)} onClick={() => void toggle(sport)}>{busyId === sport.sportId ? "Actualizando…" : sport.isActive ? "Desactivar" : "Activar"}</Button>
            </div>
            {editingId === sport.sportId ? (
              <form className="global-admin-sport-form" onSubmit={(event) => void save(event, sport)}>
                <Input label="Nombre" name="name" defaultValue={sport.name} required maxLength={80} />
                <Input label="Slug" name="slug" defaultValue={sport.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} />
                <Input label="Icono opcional" name="icon" defaultValue={sport.icon ?? ""} maxLength={80} />
                <Input label="Orden" name="sortOrder" type="number" min="0" max="100000" defaultValue={sport.sortOrder} required />
                <Button type="submit" disabled={busyId === sport.sportId}>{busyId === sport.sportId ? "Guardando…" : "Guardar deporte"}</Button>
              </form>
            ) : null}
          </article>
        ))}
      </div>

      <form className="global-admin-sport-form global-admin-sport-form--create" onSubmit={(event) => void save(event)}>
        <h3>Añadir deporte</h3>
        <Input label="Nombre" name="name" required maxLength={80} placeholder="Ej. Tenis" />
        <Input label="Slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} placeholder="tenis" />
        <Input label="Icono opcional" name="icon" maxLength={80} />
        <Input label="Orden" name="sortOrder" type="number" min="0" max="100000" defaultValue="50" required />
        <Button type="submit" disabled={busyId === "new"}>{busyId === "new" ? "Creando…" : "Crear deporte"}</Button>
      </form>
    </section>
  );
}
