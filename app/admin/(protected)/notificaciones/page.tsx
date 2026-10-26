import Link from "next/link";
import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

type NotificationCursor = { createdAt: string; id: string };

function isUuid(value: string | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function notificationCursor(params: { cursorCreated?: string; cursorId?: string }): NotificationCursor | null {
  if (!params.cursorCreated || !isUuid(params.cursorId)) return null;
  const createdAt = new Date(params.cursorCreated);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt: createdAt.toISOString(), id: params.cursorId!.toLowerCase() };
}

function notificationsHref(cursor?: NotificationCursor | null) {
  if (!cursor) return "/admin/notificaciones";
  const params = new URLSearchParams({ cursorCreated: cursor.createdAt, cursorId: cursor.id });
  return `/admin/notificaciones?${params.toString()}`;
}

export default async function AdminNotificationsPage({ searchParams }: {
  searchParams: Promise<{ cursorCreated?: string; cursorId?: string }>;
}) {
  const context = await requireAdminContext();
  const params = await searchParams;
  const cursor = notificationCursor(params);
  let notifications: Database["public"]["Functions"]["get_admin_notifications_page"]["Returns"] = [];
  let nextCursor: NotificationCursor | null = null;
  let unreadCount = 0;

  if (!isLocalDevAdminUserId(context.userId)) {
    try {
      const supabase = await createServerSupabaseClient();
      const [notificationsResult, unreadResult] = await Promise.all([
        supabase.rpc("get_admin_notifications_page", {
          p_limit: PAGE_SIZE + 1,
          p_cursor_created_at: cursor?.createdAt ?? null,
          p_cursor_id: cursor?.id ?? null,
        }),
        supabase.rpc("get_admin_notification_unread_count"),
      ]);
      if (!notificationsResult.error) {
        const notificationsWithExtra = notificationsResult.data ?? [];
        notifications = notificationsWithExtra.slice(0, PAGE_SIZE);
        if (notificationsWithExtra.length > PAGE_SIZE) {
          const last = notifications.at(-1)!;
          nextCursor = { createdAt: last.created_at, id: last.notification_id };
        }
      }
      if (!unreadResult.error && typeof unreadResult.data === "number") unreadCount = unreadResult.data;
    } catch {
      notifications = [];
      unreadCount = 0;
    }
  }

  return (
    <>
      <AdminNotificationCenter
        notifications={notifications}
        unreadCount={unreadCount}
        timezone={context.timezone}
        pageEnd={Boolean(cursor) && notifications.length === 0}
      />
      {cursor || nextCursor ? (
        <nav className="admin-reservation-actions" aria-label="Paginación de notificaciones administrativas">
          {cursor ? <Link className="button button--ghost" href={notificationsHref()}>Volver al inicio</Link> : null}
          {nextCursor ? <Link className="button button--ghost" href={notificationsHref(nextCursor)}>Ver notificaciones más antiguas →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}

