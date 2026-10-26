"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import type { Database } from "@/lib/data/supabase/database.types";
import { createPublicBrowserSupabaseClient } from "@/lib/data/supabase/browser";
import { customerNotificationMeta } from "@/lib/notifications";

type CustomerNotification = Database["public"]["Functions"]["get_my_notifications_page"]["Returns"][number];

function formatDateTime(value: string | null, timezone: string) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function CustomerNotificationCenter({ notifications, unreadCount, pageEnd = false }: { notifications: CustomerNotification[]; unreadCount: number; pageEnd?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function markOne(notificationId: string) {
    if (pending) return;
    setBusyId(notificationId);
    setMessage(null);
    startTransition(async () => {
      try {
        const { error } = await createPublicBrowserSupabaseClient().rpc("mark_my_notification_read", {
          p_notification_id: notificationId,
        });
        if (error) setMessage("No pudimos marcar la notificación como leída.");
        else router.refresh();
      } catch {
        setMessage("No pudimos actualizar las notificaciones.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function markAll() {
    if (pending || unreadCount === 0) return;
    setBusyId("all");
    setMessage(null);
    startTransition(async () => {
      try {
        const { error } = await createPublicBrowserSupabaseClient().rpc("mark_all_my_notifications_read");
        if (error) setMessage("No pudimos marcar todas las notificaciones.");
        else router.refresh();
      } catch {
        setMessage("No pudimos actualizar las notificaciones.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <section className="account-notifications" aria-labelledby="customer-notifications-title">
      <div className="account-section-heading account-section-heading--actions">
        <div>
          <span className="eyebrow">NOTIFICACIONES</span>
          <h2 id="customer-notifications-title">Actividad de tus reservas</h2>
          <p>{unreadCount ? `${unreadCount} ${unreadCount === 1 ? "notificación nueva" : "notificaciones nuevas"}.` : "No tienes notificaciones pendientes."}</p>
        </div>
        {unreadCount > 0 ? <button className="button button--ghost" type="button" disabled={pending} onClick={markAll}>{busyId === "all" ? "Marcando…" : "Marcar todas como leídas"}</button> : null}
      </div>
      {message ? <p className="auth-error" role="alert">{message}</p> : null}
      {notifications.length ? (
        <div className="account-notification-list">
          {notifications.map((notification) => {
            const meta = customerNotificationMeta(notification.event_type);
            const targetDate = notification.requested_start_at ?? notification.start_at;
            const targetCourt = notification.requested_court_name ?? notification.court_name;
            return (
              <article className={notification.read_at ? "account-notification-card" : "account-notification-card account-notification-card--unread"} key={notification.notification_id}>
                <div className="account-notification-card__head">
                  <div><Badge tone={meta.tone}>{notification.read_at ? "Leída" : "Nueva"}</Badge><h3>{meta.title}</h3></div>
                  <time dateTime={notification.created_at}>{formatDateTime(notification.created_at, notification.business_timezone)}</time>
                </div>
                <p>{meta.detail}</p>
                <dl>
                  <div><dt>Negocio</dt><dd>{notification.business_name}</dd></div>
                  {targetCourt ? <div><dt>Cancha</dt><dd>{targetCourt}</dd></div> : null}
                  {targetDate ? <div><dt>Horario</dt><dd>{formatDateTime(targetDate, notification.business_timezone)}</dd></div> : null}
                </dl>
                {!notification.read_at ? <button className="button button--ghost" type="button" disabled={pending && busyId === notification.notification_id} onClick={() => markOne(notification.notification_id)}>{busyId === notification.notification_id ? "Marcando…" : "Marcar como leída"}</button> : null}
              </article>
            );
          })}
        </div>
      ) : <div className="account-empty"><h3>{pageEnd ? "No hay más notificaciones en esta página" : "Sin actividad nueva"}</h3><p>{pageEnd ? "Vuelve al inicio para continuar navegando tu historial de notificaciones." : "Las confirmaciones y solicitudes de cambio aparecerán aquí."}</p></div>}
    </section>
  );
}

