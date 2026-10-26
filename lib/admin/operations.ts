import type { AdminRole } from "../auth.ts";

export type AdminOperation =
  | "read_schedule"
  | "confirm_reservation"
  | "reject_reservation"
  | "expire_pending_reservation"
  | "complete_reservation"
  | "cancel_reservation"
  | "resolve_change_request"
  | "propose_reschedule"
  | "withdraw_reschedule_proposal"
  | "expire_reschedule_proposal"
  | "expire_customer_change_request"
  | "archive_reservation"
  | "restore_archived_reservation"
  | "create_manual_reservation"
  | "edit_reservation"
  | "create_block"
  | "unblock";

export type AdminBlockReason =
  | "maintenance"
  | "academy"
  | "tournament"
  | "event"
  | "closure"
  | "other";

export const ADMIN_BLOCK_REASONS: AdminBlockReason[] = [
  "maintenance",
  "academy",
  "tournament",
  "event",
  "closure",
  "other",
];

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminOperation>> = {
  owner: new Set([
    "read_schedule",
    "confirm_reservation",
    "reject_reservation",
    "expire_pending_reservation",
    "complete_reservation",
    "cancel_reservation",
    "resolve_change_request",
    "propose_reschedule",
    "withdraw_reschedule_proposal",
    "expire_reschedule_proposal",
    "expire_customer_change_request",
    "archive_reservation",
    "restore_archived_reservation",
    "create_manual_reservation",
    "edit_reservation",
    "create_block",
    "unblock",
  ]),
  admin: new Set([
    "read_schedule",
    "confirm_reservation",
    "reject_reservation",
    "expire_pending_reservation",
    "complete_reservation",
    "cancel_reservation",
    "resolve_change_request",
    "propose_reschedule",
    "withdraw_reschedule_proposal",
    "expire_reschedule_proposal",
    "expire_customer_change_request",
    "archive_reservation",
    "restore_archived_reservation",
    "create_manual_reservation",
    "edit_reservation",
    "create_block",
    "unblock",
  ]),
  staff: new Set([
    "read_schedule",
    "confirm_reservation",
    "reject_reservation",
    "expire_pending_reservation",
    "complete_reservation",
    "cancel_reservation",
    "create_manual_reservation",
    "create_block",
    "unblock",
  ]),
};

export function canPerformAdminOperation(role: AdminRole, operation: AdminOperation) {
  return ROLE_PERMISSIONS[role].has(operation);
}

export function blockReasonLabel(reason: AdminBlockReason) {
  const labels: Record<AdminBlockReason, string> = {
    maintenance: "Mantenimiento",
    academy: "Academia",
    tournament: "Torneo",
    event: "Evento",
    closure: "Cierre",
    other: "Otro",
  };
  return labels[reason];
}

export function adminSourceLabel(source: "admin" | "phone" | "whatsapp" | "other") {
  const labels = {
    admin: "Panel administrativo",
    phone: "Llamada",
    whatsapp: "WhatsApp",
    other: "Otro",
  } as const;
  return labels[source];
}

export type ReservationTransitionAction = "confirm" | "complete" | "cancel";
export type ReservationTransitionResult =
  | { allowed: true; nextStatus: "pending" | "confirmed" | "cancelled" | "completed"; idempotent: boolean }
  | { allowed: false; reason: "invalid_status_transition" };

export function reservationTransition(
  current: "pending" | "confirmed" | "cancelled" | "completed",
  action: ReservationTransitionAction,
): ReservationTransitionResult {
  if (action === "confirm") {
    if (current === "confirmed") return { allowed: true, nextStatus: "confirmed", idempotent: true };
    if (current === "pending") return { allowed: true, nextStatus: "confirmed", idempotent: false };
    return { allowed: false, reason: "invalid_status_transition" };
  }

  if (action === "complete") {
    if (current === "completed") return { allowed: true, nextStatus: "completed", idempotent: true };
    if (current === "confirmed") return { allowed: true, nextStatus: "completed", idempotent: false };
    return { allowed: false, reason: "invalid_status_transition" };
  }

  if (current === "cancelled") return { allowed: true, nextStatus: "cancelled", idempotent: true };
  if (current === "pending" || current === "confirmed") {
    return { allowed: true, nextStatus: "cancelled", idempotent: false };
  }
  return { allowed: false, reason: "invalid_status_transition" };
}
