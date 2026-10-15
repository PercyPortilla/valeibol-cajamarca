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

export default async function AdminReservationsPage() {
  const context = await requireAdminContext();
  let reservations;

  try {
    reservations = await createAdminReservationRepository({ local: isLocalDevAdminUserId(context.userId) }).list(100);
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
          <p className="admin-subtitle">PII visible únicamente aquí para usuarios autorizados de {context.businessName}. Confirmar y cancelar usan operaciones server-side específicas.</p>
        </div>
        <Badge tone="success">Operativa</Badge>
      </header>

      {reservations.length === 0 ? (
        <EmptyState title="Todavía no hay solicitudes" detail="Cuando un cliente envíe una solicitud real desde la web pública, aparecerá aquí." />
      ) : (
        <div className="admin-reservation-list" aria-label="Solicitudes de reserva">
          {reservations.map((reservation) => (
            <article className="admin-reservation-card" key={reservation.id}>
              <div className="admin-reservation-card__head">
                <div>
                  <span className="admin-reservation-card__court">{reservation.courtName}</span>
                  <strong>{formatAdminDateTime(reservation.startAt, context.timezone)}</strong>
                  <small>hasta {formatAdminDateTime(reservation.endAt, context.timezone)}</small>
                </div>
                <Badge tone={reservationStatusTone(reservation.status)}>{reservationStatusLabel(reservation.status)}</Badge>
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
              <AdminReservationActions reservationId={reservation.id} status={reservation.status} role={context.role} />
            </article>
          ))}
        </div>
      )}
    </>
  );
}
