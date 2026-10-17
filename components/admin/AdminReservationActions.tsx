"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "../../lib/auth.ts";
import type { AdminReservationStatus } from "../../lib/admin/reservations.ts";
import { canPerformAdminOperation } from "../../lib/admin/operations.ts";
import {
  archiveCancelledReservationAction,
  cancelReservationAction,
  confirmReservationAction,
  restoreArchivedReservationAction,
  type AdminActionResult,
} from "../../app/admin/(protected)/actions.ts";

export function AdminReservationActions({
  reservationId,
  status,
  role,
  archivedAt,
}: {
  reservationId: string;
  status: AdminReservationStatus;
  role: AdminRole;
  archivedAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);

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

  const canConfirm = status === "pending" && canPerformAdminOperation(role, "confirm_reservation");
  const canCancel = (status === "pending" || status === "confirmed") && canPerformAdminOperation(role, "cancel_reservation");
  const canArchive = status === "cancelled" && !archivedAt && canPerformAdminOperation(role, "archive_reservation");
  const canRestore = status === "cancelled" && Boolean(archivedAt) && canPerformAdminOperation(role, "restore_archived_reservation");

  if (!canConfirm && !canCancel && !canArchive && !canRestore) return null;

  return (
    <div className="admin-reservation-actions">
      {canConfirm ? (
        <button className="button button--secondary" type="button" disabled={pending} onClick={() => run(() => confirmReservationAction(reservationId))}>
          {pending ? "Procesando…" : "Confirmar"}
        </button>
      ) : null}
      {canCancel ? (
        <button
          className="button button--ghost button--danger-soft"
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("¿Cancelar esta reserva? El horario se liberará.")) run(() => cancelReservationAction(reservationId));
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
