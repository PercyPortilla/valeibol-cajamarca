export function reservationAuditEventMeta(eventType: string) {
  const labels: Record<string, { title: string; tone: "info" | "success" | "warning" | "danger" | "neutral" }> = {
    reservation_created: { title: "Reserva creada", tone: "info" },
    reservation_confirmed: { title: "Reserva confirmada", tone: "success" },
    reservation_cancelled: { title: "Reserva cancelada", tone: "danger" },
    reservation_rejected: { title: "Solicitud de reserva rechazada", tone: "danger" },
    reservation_withdrawn: { title: "Solicitud de reserva retirada", tone: "neutral" },
    reservation_expired: { title: "Solicitud de reserva expirada", tone: "neutral" },
    reservation_completed: { title: "Reserva completada", tone: "success" },
    reservation_rescheduled: { title: "Horario reprogramado", tone: "warning" },
    reservation_details_updated: { title: "Detalles actualizados", tone: "neutral" },
    reservation_account_linked: { title: "Reserva vinculada a cuenta", tone: "info" },
    reservation_customer_changed: { title: "Cliente asociado actualizado", tone: "neutral" },
    reservation_archived: { title: "Reserva archivada", tone: "neutral" },
    reservation_restored: { title: "Reserva restaurada", tone: "info" },
    cancellation_requested: { title: "Cancelación solicitada", tone: "warning" },
    cancellation_approved: { title: "Cancelación aprobada", tone: "success" },
    cancellation_rejected: { title: "Cancelación rechazada", tone: "danger" },
    cancellation_expired: { title: "Cancelación expirada", tone: "neutral" },
    cancellation_withdrawn: { title: "Cancelación retirada por cliente", tone: "neutral" },
    reschedule_requested: { title: "Reprogramación solicitada", tone: "warning" },
    reschedule_approved: { title: "Reprogramación aprobada", tone: "success" },
    reschedule_rejected: { title: "Reprogramación rechazada", tone: "danger" },
    reschedule_expired: { title: "Reprogramación expirada", tone: "neutral" },
    reschedule_withdrawn: { title: "Reprogramación retirada por cliente", tone: "neutral" },
    reschedule_proposed: { title: "Reprogramación propuesta", tone: "warning" },
    reschedule_proposal_accepted: { title: "Propuesta aceptada", tone: "success" },
    reschedule_proposal_rejected: { title: "Propuesta rechazada", tone: "danger" },
    reschedule_proposal_withdrawn: { title: "Propuesta retirada", tone: "neutral" },
    reschedule_proposal_expired: { title: "Propuesta expirada", tone: "neutral" },
  };
  return labels[eventType] ?? { title: "Cambio registrado", tone: "neutral" as const };
}

