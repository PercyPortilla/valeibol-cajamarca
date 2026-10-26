import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AdminReservationActions } from "@/components/admin/AdminReservationActions";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { createAdminReservationRepository } from "@/lib/data/adminService";
import {
  AdminReservationRepositoryError,
  type AdminReservationCursor,
  type AdminReservationView,
} from "@/lib/data/repositories/adminReservationRepository";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import {
  formatAdminDateTime,
  formatMoney,
  lightingLabel,
  reservationStatusLabel,
  reservationStatusTone,
} from "@/lib/admin/reservations";
import { netHeightLabel } from "@/lib/booking";
import { buildWhatsAppChatHref } from "@/lib/whatsapp/links";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import { AdminReservationChangeRequests, type AdminReservationChangeRequest } from "@/components/admin/AdminReservationChangeRequests";
import { AdminBusinessRescheduleProposal } from "@/components/admin/AdminBusinessRescheduleProposal";

function reservationView(value: string | undefined): AdminReservationView {
  return value === "completed" || value === "cancelled" || value === "archived" ? value : "active";
}

const CHANGE_REQUEST_PAGE_SIZE = 20;

type ChangeRequestCursor = { createdAt: string; id: string };

const VIEW_META: Record<AdminReservationView, { label: string; emptyTitle: string; emptyDetail: string }> = {
  active: {
    label: "Activas",
    emptyTitle: "No hay reservas activas",
    emptyDetail: "Las solicitudes pendientes y reservas confirmadas aparecerán aquí.",
  },
  completed: {
    label: "Completadas",
    emptyTitle: "No hay reservas completadas",
    emptyDetail: "Las reservas ya finalizadas se separan aquí para mantener limpia la operación diaria.",
  },
  cancelled: {
    label: "Canceladas",
    emptyTitle: "No hay canceladas por archivar",
    emptyDetail: "Cuando canceles una reserva podrás archivarla desde esta vista sin borrar su registro.",
  },
  archived: {
    label: "Archivadas",
    emptyTitle: "No hay reservas archivadas",
    emptyDetail: "Las canceladas que archives quedarán aquí y podrás restaurarlas cuando sea necesario.",
  },
};

function reservationCursor(params: { cursorStart?: string; cursorCreated?: string; cursorId?: string }): AdminReservationCursor | null {
  if (!params.cursorStart || !params.cursorCreated || !params.cursorId) return null;
  const startAt = new Date(params.cursorStart);
  const createdAt = new Date(params.cursorCreated);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(createdAt.getTime())) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.cursorId)) return null;
  return { startAt: startAt.toISOString(), createdAt: createdAt.toISOString(), id: params.cursorId.toLowerCase() };
}

function changeRequestCursor(params: { changeCursorCreated?: string; changeCursorId?: string }): ChangeRequestCursor | null {
  if (!params.changeCursorCreated || !params.changeCursorId) return null;
  const createdAt = new Date(params.changeCursorCreated);
  if (Number.isNaN(createdAt.getTime())) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.changeCursorId)) return null;
  return { createdAt: createdAt.toISOString(), id: params.changeCursorId.toLowerCase() };
}

function reservationPageHref(view: AdminReservationView, cursor?: AdminReservationCursor | null, changeCursor?: ChangeRequestCursor | null) {
  const params = new URLSearchParams();
  if (view !== "active") params.set("view", view);
  if (cursor) {
    params.set("cursorStart", cursor.startAt);
    params.set("cursorCreated", cursor.createdAt);
    params.set("cursorId", cursor.id);
  }
  if (changeCursor) {
    params.set("changeCursorCreated", changeCursor.createdAt);
    params.set("changeCursorId", changeCursor.id);
  }
  const query = params.toString();
  return query ? `/admin/reservas?${query}` : "/admin/reservas";
}

export default async function AdminReservationsPage({ searchParams }: {
  searchParams: Promise<{ view?: string; cursorStart?: string; cursorCreated?: string; cursorId?: string; changeCursorCreated?: string; changeCursorId?: string }>;
}) {
  const context = await requireAdminContext();
  const params = await searchParams;
  const view = reservationView(params.view);
  const cursor = reservationCursor(params);
  const pendingChangeCursor = changeRequestCursor(params);
  const renderedAt = new Date().toISOString();
  let reservations;
  let nextCursor: AdminReservationCursor | null = null;
  let changeRequests: AdminReservationChangeRequest[] = [];
  let nextChangeRequestCursor: ChangeRequestCursor | null = null;
  const pendingChangeReservationIds = new Set<string>();

  try {
    const page = await createAdminReservationRepository({ local: isLocalDevAdminUserId(context.userId) }).listPage({
      view,
      limit: 40,
      cursor,
    });
    reservations = page.items;
    nextCursor = page.nextCursor;
    if (view === "active" && !isLocalDevAdminUserId(context.userId)) {
      const supabase = await createServerSupabaseClient();
      const result = await supabase.rpc("get_admin_pending_reservation_change_requests_page", {
        p_limit: CHANGE_REQUEST_PAGE_SIZE + 1,
        p_cursor_created_at: pendingChangeCursor?.createdAt ?? null,
        p_cursor_id: pendingChangeCursor?.id ?? null,
      });
      if (result.error) throw result.error;
      const requestsWithExtra = (result.data ?? []) as AdminReservationChangeRequest[];
      changeRequests = requestsWithExtra.slice(0, CHANGE_REQUEST_PAGE_SIZE);
      if (requestsWithExtra.length > CHANGE_REQUEST_PAGE_SIZE) {
        const last = changeRequests.at(-1)!;
        nextChangeRequestCursor = { createdAt: last.created_at, id: last.request_id };
      }

      if (reservations.length) {
        const flagsResult = await supabase.rpc("get_admin_pending_change_reservation_ids", {
          p_reservation_ids: reservations.map((reservation) => reservation.id),
        });
        if (flagsResult.error) throw flagsResult.error;
        for (const row of flagsResult.data ?? []) pendingChangeReservationIds.add(row.reservation_id);
      }
    }
  } catch (error) {
    return (
      <>
        <header className="admin-topbar">
          <div><span className="eyebrow">RESERVAS</span><h1>Solicitudes</h1></div>
        </header>
        <ErrorState title={error instanceof AdminReservationRepositoryError ? error.message : "No pudimos cargar las solicitudes"} />
      </>
    );
  }

  return (
    <>
      <header className="admin-topbar">
        <div>
          <span className="eyebrow">LECTURA ADMINISTRATIVA</span>
          <h1>Solicitudes y reservas</h1>
          <p className="admin-subtitle">Gestiona las reservas de {context.businessName}. Las canceladas pueden archivarse sin borrar sus datos de auditoría ni sus métricas históricas.</p>
        </div>
        <Badge tone="success">Operativa</Badge>
      </header>

      <nav className="admin-reservation-filters" aria-label="Filtrar reservas por estado">
        {(Object.keys(VIEW_META) as AdminReservationView[]).map((key) => (
          <Link
            key={key}
            href={reservationPageHref(key)}
            className={view === key ? "admin-reservation-filter admin-reservation-filter--active" : "admin-reservation-filter"}
            aria-current={view === key ? "page" : undefined}
          >
            {VIEW_META[key].label}
          </Link>
        ))}
      </nav>

      {view === "active" ? <>
        <AdminReservationChangeRequests
          requests={changeRequests}
          role={context.role}
          timezone={context.timezone}
          nowIso={renderedAt}
          pageEnd={Boolean(pendingChangeCursor) && changeRequests.length === 0}
        />
        {pendingChangeCursor || nextChangeRequestCursor ? (
          <nav className="admin-reservation-actions" aria-label="Paginación de solicitudes de cambio pendientes">
            {pendingChangeCursor ? <Link className="button button--ghost" href={reservationPageHref(view, cursor)}>Volver al inicio de solicitudes</Link> : null}
            {nextChangeRequestCursor ? <Link className="button button--ghost" href={reservationPageHref(view, cursor, nextChangeRequestCursor)}>Ver solicitudes más antiguas →</Link> : null}
          </nav>
        ) : null}
      </> : null}

      {reservations.length === 0 ? (
        <EmptyState title={VIEW_META[view].emptyTitle} detail={VIEW_META[view].emptyDetail} />
      ) : (
        <div className="admin-reservation-list" aria-label="Solicitudes de reserva">
          {reservations.map((reservation) => {
            const hasPendingChange = pendingChangeReservationIds.has(reservation.id);
            const pendingExpired = reservation.status === "pending" && new Date(reservation.startAt).getTime() <= new Date(renderedAt).getTime();
            const whatsappHref = reservation.customerPhoneE164
              ? buildWhatsAppChatHref(
                  reservation.customerPhoneE164,
                  `Hola ${reservation.customerName ?? ""}. Te escribimos por tu reserva en ${reservation.courtName}.`,
                )
              : null;
            return (
            <article className={reservation.archivedAt ? "admin-reservation-card admin-reservation-card--archived" : "admin-reservation-card"} key={reservation.id}>
              <div className="admin-reservation-card__head">
                <div>
                  <span className="admin-reservation-card__court">{reservation.courtName}</span>
                  <strong>{formatAdminDateTime(reservation.startAt, context.timezone)}</strong>
                  <small>hasta {formatAdminDateTime(reservation.endAt, context.timezone)}</small>
                </div>
                <div className="admin-reservation-card__badges">
                  <Badge tone={reservationStatusTone(reservation.status)}>{reservationStatusLabel(reservation.status)}</Badge>
                  {pendingExpired ? <Badge tone="danger">Vencida</Badge> : null}
                  {reservation.archivedAt ? <Badge tone="neutral">Archivada</Badge> : null}
                </div>
              </div>
              <dl className="admin-reservation-details">
                <div><dt>Cliente</dt><dd>{reservation.customerName ?? "Sin nombre disponible"}</dd></div>
                <div>
                  <dt>WhatsApp</dt>
                  <dd>
                    <span>{reservation.customerPhoneE164 ?? "Sin teléfono disponible"}</span>
                    {whatsappHref ? <a className="admin-whatsapp-link" href={whatsappHref} target="_blank" rel="noreferrer">Abrir chat ↗</a> : null}
                  </dd>
                </div>
                <div><dt>Modalidad</dt><dd>{lightingLabel(reservation.lighting)}</dd></div>
                <div><dt>Altura de red</dt><dd>{netHeightLabel(reservation.netHeightCm)}</dd></div>
                <div><dt>Tarifa aplicada</dt><dd>{formatMoney(reservation.hourlyRate, reservation.currency)}/h</dd></div>
                <div><dt>Valor de reserva</dt><dd>{formatMoney(reservation.totalAmount, reservation.currency)}</dd></div>
                <div><dt>Origen</dt><dd>{reservation.source === "public_web" ? "Web pública" : reservation.source}</dd></div>
              </dl>
              <AdminReservationActions
                reservationId={reservation.id}
                status={reservation.status}
                role={context.role}
                archivedAt={reservation.archivedAt}
                startAt={reservation.startAt}
                endAt={reservation.endAt}
                nowIso={renderedAt}
              />
              {!isLocalDevAdminUserId(context.userId) && reservation.status === "confirmed" && (context.role === "owner" || context.role === "admin") ? (
                <AdminBusinessRescheduleProposal
                  reservationId={reservation.id}
                  currentCourtId={reservation.courtId}
                  startAt={reservation.startAt}
                  endAt={reservation.endAt}
                  timezone={context.timezone}
                  hasPendingChange={hasPendingChange}
                />
              ) : null}
              <div className="admin-reservation-actions"><Link className="button button--ghost" href={`/admin/reservas/${reservation.id}/historial`}>Ver historial</Link></div>
            </article>
            );
          })}
        </div>
      )}

      {cursor || nextCursor ? (
        <nav className="admin-reservation-actions" aria-label="Paginación del historial de reservas">
          {cursor ? <Link className="button button--ghost" href={reservationPageHref(view)}>Volver al inicio</Link> : null}
          {nextCursor ? <Link className="button button--ghost" href={reservationPageHref(view, nextCursor)}>Ver más antiguas →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}
