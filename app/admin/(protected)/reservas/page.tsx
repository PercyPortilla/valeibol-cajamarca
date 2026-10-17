import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AdminReservationActions } from "@/components/admin/AdminReservationActions";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { createAdminReservationRepository } from "@/lib/data/adminService";
import { AdminReservationRepositoryError } from "@/lib/data/repositories/adminReservationRepository";
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

type ReservationView = "active" | "completed" | "cancelled" | "archived";

function reservationView(value: string | undefined): ReservationView {
  return value === "completed" || value === "cancelled" || value === "archived" ? value : "active";
}

const VIEW_META: Record<ReservationView, { label: string; emptyTitle: string; emptyDetail: string }> = {
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

export default async function AdminReservationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const context = await requireAdminContext();
  const params = await searchParams;
  const view = reservationView(params.view);
  let reservations;

  try {
    const records = await createAdminReservationRepository({ local: isLocalDevAdminUserId(context.userId) }).list(200, view === "archived");
    reservations = records.filter((reservation) => {
      if (view === "active") return !reservation.archivedAt && (reservation.status === "pending" || reservation.status === "confirmed");
      if (view === "completed") return !reservation.archivedAt && reservation.status === "completed";
      if (view === "cancelled") return !reservation.archivedAt && reservation.status === "cancelled";
      return Boolean(reservation.archivedAt);
    });
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
        {(Object.keys(VIEW_META) as ReservationView[]).map((key) => (
          <Link
            key={key}
            href={key === "active" ? "/admin/reservas" : `/admin/reservas?view=${key}`}
            className={view === key ? "admin-reservation-filter admin-reservation-filter--active" : "admin-reservation-filter"}
            aria-current={view === key ? "page" : undefined}
          >
            {VIEW_META[key].label}
          </Link>
        ))}
      </nav>

      {reservations.length === 0 ? (
        <EmptyState title={VIEW_META[view].emptyTitle} detail={VIEW_META[view].emptyDetail} />
      ) : (
        <div className="admin-reservation-list" aria-label="Solicitudes de reserva">
          {reservations.map((reservation) => (
            <article className={reservation.archivedAt ? "admin-reservation-card admin-reservation-card--archived" : "admin-reservation-card"} key={reservation.id}>
              <div className="admin-reservation-card__head">
                <div>
                  <span className="admin-reservation-card__court">{reservation.courtName}</span>
                  <strong>{formatAdminDateTime(reservation.startAt, context.timezone)}</strong>
                  <small>hasta {formatAdminDateTime(reservation.endAt, context.timezone)}</small>
                </div>
                <div className="admin-reservation-card__badges">
                  <Badge tone={reservationStatusTone(reservation.status)}>{reservationStatusLabel(reservation.status)}</Badge>
                  {reservation.archivedAt ? <Badge tone="neutral">Archivada</Badge> : null}
                </div>
              </div>
              <dl className="admin-reservation-details">
                <div><dt>Cliente</dt><dd>{reservation.customerName ?? "Sin nombre disponible"}</dd></div>
                <div><dt>WhatsApp</dt><dd>{reservation.customerPhoneE164 ?? "Sin teléfono disponible"}</dd></div>
                <div><dt>Modalidad</dt><dd>{lightingLabel(reservation.lighting)}</dd></div>
                <div><dt>Altura de red</dt><dd>{netHeightLabel(reservation.netHeightCm)}</dd></div>
                <div><dt>Tarifa aplicada</dt><dd>{formatMoney(reservation.hourlyRate, reservation.currency)}/h</dd></div>
                <div><dt>Total autoritativo</dt><dd>{formatMoney(reservation.totalAmount, reservation.currency)}</dd></div>
                <div><dt>Origen</dt><dd>{reservation.source === "public_web" ? "Web pública" : reservation.source}</dd></div>
              </dl>
              <AdminReservationActions reservationId={reservation.id} status={reservation.status} role={context.role} archivedAt={reservation.archivedAt} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
