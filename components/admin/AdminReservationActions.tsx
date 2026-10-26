"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "../../lib/auth.ts";
import type { AdminReservationStatus } from "../../lib/admin/reservations.ts";
import { canPerformAdminOperation } from "../../lib/admin/operations.ts";
import {
  archiveCancelledReservationAction,
  cancelReservationAction,
  completeReservationAction,
  confirmReservationAction,
  expirePendingReservationAction,
  rejectPendingReservationAction,
  restoreArchivedReservationAction,
  type AdminActionResult,
} from "../../app/admin/(protected)/actions.ts";

export function AdminReservationActions({
  reservationId,
  status,
  role,
  archivedAt,
  startAt,
  endAt,
  nowIso,
}: {
  reservationId: string;
  status: AdminReservationStatus;
  role: AdminRole;
  archivedAt: string | null;
  startAt: string;
  endAt: string;
  nowIso: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);
  const [completionAvailable, setCompletionAvailable] = useState(false);

  useEffect(() => {
    if (status !== "confirmed") {
      setCompletionAvailable(false);
      return;
    }
    const refresh = () => setCompletionAvailable(new Date(endAt).getTime() <= Date.now());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [endAt, status]);

  function run(task: () => Promise<AdminActionResult>) {
    setResult(null);
    startTransition(async () => {
      const next = await task();
      setResult(next);
      if (next.ok) router.refresh();
      if (!next.ok && next.code === "unauthenticated") {
        window.setTimeout(() => router.push("/admin/login?reason=session"), 900);
      }
    });
  }

  const pendingExpired = status === "pending" && new Date(startAt).getTime() <= new Date(nowIso).getTime();
  const canConfirm = status === "pending" && !pendingExpired && canPerformAdminOperation(role, "confirm_reservation");
  const canReject = status === "pending" && !pendingExpired && canPerformAdminOperation(role, "reject_reservation");
  const canExpire = status === "pending" && pendingExpired && canPerformAdminOperation(role, "expire_pending_reservation");
  const canComplete = status === "confirmed" && completionAvailable && canPerformAdminOperation(role, "complete_reservation");
  const canCancel = status === "confirmed" && canPerformAdminOperation(role, "cancel_reservation");
  const canArchive = status === "cancelled" && !archivedAt && canPerformAdminOperation(role, "archive_reservation");
  const canRestore = status === "cancelled" && Boolean(archivedAt) && canPerformAdminOperation(role, "restore_archived_reservation");

  if (!canConfirm && !canReject && !canExpire && !canComplete && !canCancel && !canArchive && !canRestore) return null;

  return (
    <div className="admin-reservation-actions">
      {canConfirm ? (
        <button className="button button--secondary" type="button" disabled={pending} onClick={() => run(() => confirmReservationAction(reservationId))}>
          {pending ? "Procesando…" : "Confirmar"}
        </button>
      ) : null}
      {canComplete ? (
        <button className="button button--secondary" type="button" disabled={pending} onClick={() => run(() => completeReservationAction(reservationId))}>
          {pending ? "Procesando…" : "Marcar completada"}
        </button>
      ) : null}
      {canReject ? (
        <button
          className="button button--ghost button--danger-soft"
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("¿Rechazar esta solicitud de reserva? El cliente verá que no fue aceptada y el horario se liberará.")) {
              run(() => rejectPendingReservationAction(reservationId));
            }
          }}
        >
          Rechazar
        </button>
      ) : null}
      {canExpire ? (
        <button
          className="button button--ghost button--danger-soft"
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("¿Expirar esta solicitud vencida? Se cerrará sin registrarla como rechazo del negocio.")) {
              run(() => expirePendingReservationAction(reservationId));
            }
          }}
        >
          Expirar
        </button>
      ) : null}
      {canCancel ? (
        <button
          className="button button--ghost button--danger-soft"
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("¿Cancelar esta reserva confirmada? El cliente verá la cancelación y el horario se liberará.")) {
              run(() => cancelReservationAction(reservationId));
            }
          }}
        >
          Cancelar
        </button>
      ) : null}
      {canArchive ? (
        <button
          className="button button--ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("¿Archivar esta reserva cancelada? Desaparecerá del historial principal, pero se conservará para auditoría y reportes.")) {
              run(() => archiveCancelledReservationAction(reservationId));
            }
          }}
        >
          {pending ? "Archivando…" : "Archivar"}
        </button>
      ) : null}
      {canRestore ? (
        <button
          className="button button--secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("¿Restaurar esta reserva cancelada al historial?")) {
              run(() => restoreArchivedReservationAction(reservationId));
            }
          }}
        >
          {pending ? "Restaurando…" : "Restaurar"}
        </button>
      ) : null}
      {result ? <span className={result.ok ? "admin-inline-feedback admin-inline-feedback--success" : "admin-inline-feedback admin-inline-feedback--error"} role={result.ok ? "status" : "alert"}>{result.message}</span> : null}
    </div>
  );
}
