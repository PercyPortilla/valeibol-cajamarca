"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "../../lib/auth.ts";
import type { AdminReservationStatus } from "../../lib/admin/reservations.ts";
import { canPerformAdminOperation } from "../../lib/admin/operations.ts";
import {
  cancelReservationAction,
  confirmReservationAction,
  type AdminActionResult,
} from "../../app/admin/(protected)/actions.ts";

export function AdminReservationActions({
  reservationId,
  status,
  role,
}: {
  reservationId: string;
  status: AdminReservationStatus;
  role: AdminRole;
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

  if (status !== "pending" && status !== "confirmed") return null;

  return (
    <div className="admin-reservation-actions">
      {status === "pending" && canPerformAdminOperation(role, "confirm_reservation") ? (
        <button className="button button--secondary" type="button" disabled={pending} onClick={() => run(() => confirmReservationAction(reservationId))}>
          {pending ? "Procesando…" : "Confirmar"}
        </button>
      ) : null}
      {canPerformAdminOperation(role, "cancel_reservation") ? (
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
      {result ? <span className={result.ok ? "admin-inline-feedback admin-inline-feedback--success" : "admin-inline-feedback admin-inline-feedback--error"} role="status">{result.message}</span> : null}
    </div>
  );
}
