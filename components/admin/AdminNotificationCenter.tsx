"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import type { Database } from "@/lib/data/supabase/database.types";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import { adminNotificationMeta } from "@/lib/notifications";

type AdminNotification = Database["public"]["Functions"]["get_admin_notifications_page"]["Returns"][number];

function formatAdminNotificationDate(value: string | null, timezone: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

export function AdminNotificationCenter({ notifications, unreadCount, timezone, pageEnd = false }: { notifications: AdminNotification[]; unreadCount: number; timezone: string; pageEnd?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function runMark(notificationId?: string) {
    if (pending) return;
    const key = notificationId ?? "all";
    setBusyId(key);
    setMessage(null);
    startTransition(async () => {
      try {
        const client = createPublicBrowserSupabaseClient();
        const result = notificationId
          ? await client.rpc("mark_admin_notification_read", { p_notification_id: notificationId })
          : await client.rpc("mark_all_admin_notifications_read");
        if (result.error) setMessage("No pudimos actualizar el estado de lectura.");
        else router.refresh();
      } catch {
        setMessage("No pudimos actualizar las notificaciones.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <section className="admin-notification-center" aria-labelledby="admin-notifications-title">
      <header className="admin-topbar">
        <div><span className="eyebrow">ACTIVIDAD</span><h1 id="admin-notifications-title">Notificaciones</h1><p className="admin-subtitle">Solicitudes de cancelación y reprogramación del negocio. Cada operador conserva su propio estado leído/no leído.</p></div>
        {unreadCount > 0 ? <button className="button button--secondary" type="button" disabled={pending} onClick={() => runMark()}>{busyId === "all" ? "Marcando…" : `Marcar ${unreadCount} como leídas`}</button> : <Badge tone="success">Al día</Badge>}
      </header>
      {message ? <div className="admin-inline-feedback admin-inline-feedback--error" role="alert">{message}</div> : null}
      {notifications.length ? <div className="admin-reservation-list">
        {notifications.map((notification) => {
          const meta = adminNotificationMeta(notification.event_type);
          const targetDate = notification.requested_start_at ?? notification.start_at;
          const targetCourt = notification.requested_court_name ?? notification.court_name;
          return <article className={notification.read_at ? "admin-reservation-card" : "admin-reservation-card admin-notification-card--unread"} key={notification.notification_id}>
            <div className="admin-reservation-card__head"><div><Badge tone={meta.tone}>{notification.read_at ? "Leída" : "Nueva"}</Badge><strong>{meta.title}</strong><small>{formatAdminNotificationDate(notification.created_at, timezone)}</small></div></div>
            <p>{meta.detail}</p>
            <dl className="admin-reservation-details">
              {targetCourt ? <div><dt>Cancha</dt><dd>{targetCourt}</dd></div> : null}
              {targetDate ? <div><dt>Horario</dt><dd>{formatAdminNotificationDate(targetDate, timezone)}</dd></div> : null}
            </dl>
            <div className="admin-reservation-actions">
              <Link className="button button--secondary" href="/admin/reservas">Revisar reservas</Link>
              {!notification.read_at ? <button className="button button--ghost" type="button" disabled={pending && busyId === notification.notification_id} onClick={() => runMark(notification.notification_id)}>{busyId === notification.notification_id ? "Marcando…" : "Marcar como leída"}</button> : null}
            </div>
          </article>;
        })}
      </div> : <div className="admin-empty"><h2>{pageEnd ? "No hay más notificaciones en esta página" : "Sin notificaciones"}</h2><p>{pageEnd ? "Vuelve al inicio para continuar navegando el historial de notificaciones." : "Las nuevas solicitudes de cancelación o reprogramación aparecerán aquí."}</p></div>}
    </section>
  );
}

