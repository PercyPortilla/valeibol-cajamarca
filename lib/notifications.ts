export type AppNotificationEvent =
  | "reservation_requested"
  | "reservation_confirmed"
  | "reservation_rejected"
  | "reservation_cancelled"
  | "reservation_withdrawn"
  | "reservation_expired"
  | "cancellation_requested"
  | "cancellation_approved"
  | "cancellation_rejected"
  | "cancellation_expired"
  | "cancellation_withdrawn"
  | "reschedule_requested"
  | "reschedule_approved"
  | "reschedule_rejected"
  | "reschedule_expired"
  | "reschedule_withdrawn"
  | "reschedule_proposed"
  | "reschedule_proposal_accepted"
  | "reschedule_proposal_rejected"
  | "reschedule_proposal_withdrawn"
  | "reschedule_proposal_expired";

export function customerNotificationMeta(event: AppNotificationEvent) {
  switch (event) {
    case "reservation_requested":
      return { title: "Solicitud registrada", detail: "Tu solicitud de reserva fue registrada.", tone: "info" as const };
    case "reservation_confirmed":
      return { title: "Reserva confirmada", detail: "El negocio confirmó tu reserva.", tone: "success" as const };
    case "reservation_rejected":
      return { title: "Solicitud de reserva rechazada", detail: "El negocio no aceptó esta solicitud. El horario quedó liberado.", tone: "danger" as const };
    case "reservation_cancelled":
      return { title: "Reserva cancelada", detail: "El negocio canceló una reserva que ya estaba confirmada.", tone: "danger" as const };
    case "reservation_withdrawn":
      return { title: "Solicitud retirada", detail: "Retiraste una solicitud pendiente antes de su confirmación.", tone: "neutral" as const };
    case "reservation_expired":
      return { title: "Solicitud expirada", detail: "El horario pasó sin que el negocio confirmara la solicitud.", tone: "neutral" as const };
    case "cancellation_requested":
      return { title: "Cancelación solicitada", detail: "Tu reserva sigue confirmada mientras el negocio revisa la solicitud.", tone: "warning" as const };
    case "cancellation_approved":
      return { title: "Cancelación aprobada", detail: "El negocio aprobó la cancelación de tu reserva.", tone: "success" as const };
    case "cancellation_rejected":
      return { title: "Cancelación rechazada", detail: "Tu reserva original continúa confirmada.", tone: "danger" as const };
    case "cancellation_expired":
      return { title: "Solicitud de cancelación expirada", detail: "La solicitud venció sin modificar tu reserva.", tone: "neutral" as const };
    case "cancellation_withdrawn":
      return { title: "Solicitud de cancelación retirada", detail: "Retiraste tu solicitud. Tu reserva original no fue modificada.", tone: "info" as const };
    case "reschedule_requested":
      return { title: "Reprogramación solicitada", detail: "Tu horario original sigue reservado mientras se revisa el cambio.", tone: "warning" as const };
    case "reschedule_approved":
      return { title: "Reprogramación aprobada", detail: "El nuevo horario ya fue aplicado a tu reserva.", tone: "success" as const };
    case "reschedule_rejected":
      return { title: "Reprogramación rechazada", detail: "Tu horario original se mantiene.", tone: "danger" as const };
    case "reschedule_expired":
      return { title: "Solicitud de reprogramación expirada", detail: "La solicitud venció sin aplicar el cambio de horario.", tone: "neutral" as const };
    case "reschedule_withdrawn":
      return { title: "Solicitud de reprogramación retirada", detail: "Retiraste tu solicitud. Tu horario original se mantiene.", tone: "info" as const };
    case "reschedule_proposed":
      return { title: "Nueva propuesta de horario", detail: "El negocio propuso reprogramar tu reserva. Revísala en Mi cuenta antes de responder.", tone: "warning" as const };
    case "reschedule_proposal_accepted":
      return { title: "Propuesta aceptada", detail: "Aceptaste el nuevo horario propuesto por el negocio.", tone: "success" as const };
    case "reschedule_proposal_rejected":
      return { title: "Propuesta rechazada", detail: "Rechazaste el nuevo horario y tu reserva original se mantiene.", tone: "danger" as const };
    case "reschedule_proposal_withdrawn":
      return { title: "Propuesta retirada", detail: "El negocio retiró su propuesta de cambio. Tu reserva original se mantiene.", tone: "info" as const };
    case "reschedule_proposal_expired":
      return { title: "Propuesta expirada", detail: "La propuesta de cambio venció sin aplicarse. Tu reserva original no fue modificada.", tone: "neutral" as const };
  }
}

export function adminNotificationMeta(event: AppNotificationEvent) {
  if (event === "reservation_requested") {
    return { title: "Nueva solicitud de reserva", detail: "Un cliente creó una nueva solicitud desde la web pública.", tone: "info" as const };
  }
  if (event === "reservation_withdrawn") {
    return { title: "Solicitud retirada", detail: "El cliente retiró una solicitud pendiente antes de su confirmación.", tone: "neutral" as const };
  }
  if (event === "reservation_rejected") {
    return { title: "Solicitud rechazada", detail: "El negocio rechazó una solicitud pendiente.", tone: "neutral" as const };
  }
  if (event === "reservation_cancelled") {
    return { title: "Reserva cancelada", detail: "Se canceló una reserva que ya estaba confirmada.", tone: "neutral" as const };
  }
  if (event === "reservation_expired") {
    return { title: "Solicitud expirada", detail: "Una solicitud pendiente venció sin confirmación.", tone: "neutral" as const };
  }
  if (event === "cancellation_requested") {
    return { title: "Nueva solicitud de cancelación", detail: "Un cliente solicita cancelar una reserva confirmada.", tone: "warning" as const };
  }
  if (event === "reschedule_requested") {
    return { title: "Nueva solicitud de reprogramación", detail: "Un cliente solicita cambiar el horario de una reserva confirmada.", tone: "info" as const };
  }
  if (event === "cancellation_expired") {
    return { title: "Cancelación expirada", detail: "Una solicitud de cancelación venció sin modificar la reserva.", tone: "neutral" as const };
  }
  if (event === "cancellation_withdrawn") {
    return { title: "Cancelación retirada", detail: "El cliente retiró su solicitud de cancelación; la reserva no fue modificada.", tone: "neutral" as const };
  }
  if (event === "reschedule_expired") {
    return { title: "Reprogramación expirada", detail: "Una solicitud de reprogramación venció sin modificar la reserva.", tone: "neutral" as const };
  }
  if (event === "reschedule_withdrawn") {
    return { title: "Reprogramación retirada", detail: "El cliente retiró su solicitud de cambio; la reserva original se mantiene.", tone: "neutral" as const };
  }
  if (event === "reschedule_proposal_accepted") {
    return { title: "Propuesta aceptada", detail: "El cliente aceptó la reprogramación propuesta y la reserva ya fue actualizada.", tone: "success" as const };
  }
  if (event === "reschedule_proposal_rejected") {
    return { title: "Propuesta rechazada", detail: "El cliente rechazó la reprogramación propuesta; se mantiene el horario original.", tone: "warning" as const };
  }
  if (event === "reschedule_proposal_withdrawn") {
    return { title: "Propuesta retirada", detail: "El negocio retiró una propuesta pendiente sin modificar la reserva.", tone: "neutral" as const };
  }
  if (event === "reschedule_proposal_expired") {
    return { title: "Propuesta expirada", detail: "Una propuesta pendiente venció sin modificar la reserva.", tone: "neutral" as const };
  }
  if (event === "reschedule_proposed") {
    return { title: "Propuesta enviada", detail: "Se envió una propuesta de reprogramación al cliente.", tone: "info" as const };
  }
  return { title: "Actividad de reserva", detail: "Se registró un cambio en una reserva.", tone: "neutral" as const };
}

