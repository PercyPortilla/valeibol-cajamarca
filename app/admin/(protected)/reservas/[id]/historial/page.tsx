import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { requireAdminContext } from "@/lib/auth/server";
import { isLocalDevAdminUserId } from "@/lib/auth/localDev";
import { createServerSupabaseClient } from "@/lib/data/supabase/server";
import type { Database } from "@/lib/data/supabase/database.types";
import { formatAdminDateTime, formatMoney, lightingLabel, reservationStatusLabel } from "@/lib/admin/reservations";
import { reservationAuditEventMeta } from "@/lib/admin/reservationAudit";

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type AuditEvent = Database["public"]["Functions"]["get_admin_reservation_audit_page"]["Returns"][number];

const PAGE_SIZE = 50;

type AuditCursor = {
  createdAt: string;
  eventSequence: number;
};

function auditCursor(params: { cursorCreated?: string; cursorSequence?: string }): AuditCursor | null {
  if (!params.cursorCreated || !params.cursorSequence || !/^\d+$/.test(params.cursorSequence)) return null;
  const createdAt = new Date(params.cursorCreated);
  const eventSequence = Number(params.cursorSequence);
  if (Number.isNaN(createdAt.getTime()) || !Number.isSafeInteger(eventSequence) || eventSequence < 1) return null;
  return { createdAt: createdAt.toISOString(), eventSequence };
}

function auditHref(id: string, cursor?: AuditCursor | null) {
  if (!cursor) return `/admin/reservas/${id}/historial`;
  const params = new URLSearchParams({
    cursorCreated: cursor.createdAt,
    cursorSequence: String(cursor.eventSequence),
  });
  return `/admin/reservas/${id}/historial?${params.toString()}`;
}

function requestStatusLabel(status: AuditEvent["new_request_status"]) {
  if (status === "pending") return "Pendiente";
  if (status === "approved") return "Aprobada";
  if (status === "rejected") return "Rechazada";
  return "—";
}

function scheduleChanged(event: AuditEvent) {
  return event.old_court_name !== event.new_court_name
    || event.old_start_at !== event.new_start_at
    || event.old_end_at !== event.new_end_at;
}

export default async function ReservationAuditPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursorCreated?: string; cursorSequence?: string }>;
}) {
  const context = await requireAdminContext();
  const { id } = await params;
  const query = await searchParams;
  const cursor = auditCursor(query);
  if (!isUuid(id)) return <ErrorState title="Identificador de reserva inválido" />;
  if (isLocalDevAdminUserId(context.userId)) {
    return <><header className="admin-topbar"><div><span className="eyebrow">AUDITORÍA</span><h1>Historial de reserva</h1></div></header><EmptyState title="Historial remoto no disponible en modo local" detail="El historial append-only se registra sobre las operaciones reales del tenant." /></>;
  }

  let events: AuditEvent[] = [];
  let nextCursor: AuditCursor | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const result = await supabase.rpc("get_admin_reservation_audit_page", {
      p_reservation_id: id,
      p_limit: PAGE_SIZE + 1,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_event_sequence: cursor?.eventSequence ?? null,
    });
    if (result.error) return <ErrorState title="No pudimos cargar el historial de esta reserva" />;
    const eventsWithExtra = result.data ?? [];
    events = eventsWithExtra.slice(0, PAGE_SIZE);
    if (eventsWithExtra.length > PAGE_SIZE) {
      const last = events.at(-1)!;
      nextCursor = { createdAt: last.created_at, eventSequence: last.event_sequence };
    }
  } catch {
    return <ErrorState title="No pudimos cargar el historial de esta reserva" />;
  }

  const operations = events.reduce<Array<{ operationId: string; events: AuditEvent[] }>>((groups, event) => {
    const current = groups.at(-1);
    if (current?.operationId === event.operation_id) current.events.push(event);
    else groups.push({ operationId: event.operation_id, events: [event] });
    return groups;
  }, []);

  return (
    <>
      <header className="admin-topbar">
        <div><span className="eyebrow">AUDITORÍA</span><h1>Historial de reserva</h1><p className="admin-subtitle">Cambios registrados desde B42. El actor se muestra por categoría y nunca por email o teléfono.</p></div>
        <Link className="button button--secondary" href="/admin/reservas">← Volver a reservas</Link>
      </header>
      {!events.length ? <EmptyState title={cursor ? "No hay más eventos en esta página" : "Sin cambios registrados"} detail={cursor ? "El cursor ya no devuelve eventos. Vuelve al inicio del historial para continuar navegando." : "Esta reserva todavía no tiene eventos posteriores a la activación del historial B42."} /> : (
        <div className="admin-audit-timeline" aria-label="Historial de cambios de la reserva">
          {operations.map((operation) => <section className="admin-audit-operation" key={operation.operationId} aria-label={operation.events.length > 1 ? "Eventos de una misma operación" : "Evento de auditoría"}>
            {operation.events.length > 1 ? <div className="admin-audit-operation__label">Misma operación · {operation.events.length} eventos relacionados</div> : null}
            {operation.events.map((event) => {
              const meta = reservationAuditEventMeta(event.event_type);
              const hasScheduleChange = scheduleChanged(event);
              return <article className="admin-audit-event" key={event.event_id}>
                <div className="admin-audit-event__head"><div><Badge tone={meta.tone}>{meta.title}</Badge><strong>{event.actor_label}</strong></div><time dateTime={event.created_at}>{formatAdminDateTime(event.created_at, context.timezone)}</time></div>
                {event.request_type && event.new_request_status ? <p><strong>Solicitud de {event.request_type === "cancellation" ? "cancelación" : "reprogramación"}:</strong> {event.old_request_status ? `${requestStatusLabel(event.old_request_status)} → ` : ""}{requestStatusLabel(event.new_request_status)}</p> : null}
                {event.resolution_note ? <p><strong>Nota de resolución:</strong> {event.resolution_note}</p> : null}
                {event.old_status !== event.new_status && event.new_status ? <p><strong>Estado:</strong> {event.old_status ? reservationStatusLabel(event.old_status) : "—"} → {reservationStatusLabel(event.new_status)}</p> : null}
                {hasScheduleChange ? <div className="admin-audit-compare">
                  <div><small>ANTES</small><strong>{event.old_court_name ?? "—"}</strong><span>{event.old_start_at ? formatAdminDateTime(event.old_start_at, context.timezone) : "—"}{event.old_end_at ? ` → ${formatAdminDateTime(event.old_end_at, context.timezone)}` : ""}</span></div>
                  <div><small>DESPUÉS</small><strong>{event.new_court_name ?? "—"}</strong><span>{event.new_start_at ? formatAdminDateTime(event.new_start_at, context.timezone) : "—"}{event.new_end_at ? ` → ${formatAdminDateTime(event.new_end_at, context.timezone)}` : ""}</span></div>
                </div> : null}
                {event.old_lighting !== event.new_lighting && event.new_lighting ? <p><strong>Modalidad:</strong> {event.old_lighting ? lightingLabel(event.old_lighting) : "—"} → {lightingLabel(event.new_lighting)}</p> : null}
                {event.old_net_height_cm !== event.new_net_height_cm && event.new_net_height_cm !== null ? <p><strong>Altura de red:</strong> {event.old_net_height_cm ?? "—"} → {event.new_net_height_cm} cm</p> : null}
                {event.old_hourly_rate !== event.new_hourly_rate && event.new_hourly_rate !== null ? <p><strong>Tarifa por hora:</strong> {event.old_hourly_rate === null ? "—" : formatMoney(Number(event.old_hourly_rate), event.currency)} → {formatMoney(Number(event.new_hourly_rate), event.currency)}</p> : null}
                {event.old_total_amount !== event.new_total_amount && event.new_total_amount !== null ? <p><strong>Valor:</strong> {event.old_total_amount === null ? "—" : formatMoney(Number(event.old_total_amount), event.currency)} → {formatMoney(Number(event.new_total_amount), event.currency)}</p> : null}
              </article>;
            })}
          </section>)}
        </div>
      )}
      {cursor || nextCursor ? (
        <nav className="admin-reservation-actions" aria-label="Paginación del historial de auditoría">
          {cursor ? <Link className="button button--ghost" href={auditHref(id)}>Volver al inicio del historial</Link> : null}
          {nextCursor ? <Link className="button button--ghost" href={auditHref(id, nextCursor)}>Ver eventos más antiguos →</Link> : null}
        </nav>
      ) : null}
    </>
  );
}

