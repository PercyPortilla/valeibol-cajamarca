# BLOQUE 48 — Rechazo explícito de solicitudes de reserva PENDING

Continúa sobre B39–B47 cerrados. Corrige el lifecycle de la solicitud de reserva original para que rechazar una reserva pendiente no se confunda con cancelar una reserva ya confirmada.

## Objetivo funcional

- Mantener los cuatro estados históricos: pending, confirmed, cancelled y completed.
- Añadir una causa terminal closure_kind para distinguir customer_withdrawal, business_rejection y confirmed_cancellation.
- Hacer backfill conservador de retiros B30 anteriores a B48 usando evidencia de actor customer; los casos ambiguos deben quedar NULL, no reclasificarse por suposición.
- Cuando exista auditoría B42 con old_status exacto, clasificar cierres históricos del negocio: pending como business_rejection y confirmed como confirmed_cancellation.
- En Admin, una PENDING ofrece Confirmar/Rechazar. Una CONFIRMED ofrece Cancelar.
- Mi cuenta muestra Rechazada, Retirada o Cancelada según la causa real.
- El cliente recibe una notificación interna de rechazo o cancelación; el negocio recibe aviso cuando el cliente retira la solicitud.
- B42 audita cada cierre con evento semántico propio.

## Concurrencia y seguridad

- Rechazo usa admin_reject_pending_reservation(uuid) y deriva tenant/actor de phase6_admin_actor().
- Confirmar, rechazar y retirar serializan sobre la misma fila de reserva con FOR UPDATE.
- admin_reject_pending_reservation solo acepta public_web + pending; exact retry solo cancelled + business_rejection.
- admin_cancel_reservation ya no acepta pending; solo confirmed y conserva el lock B43 sobre change requests pendientes.
- withdraw_my_pending_reservation solo es idempotente si el cierre anterior fue exactamente customer_withdrawal del mismo usuario.
- Si confirmar gana la carrera, rechazar falla como ya resuelta. Si rechazar o retirar gana, confirmar falla. Un rechazo stale nunca puede cancelar una reserva ya confirmada.
- Una pending cuyo start_at ya comenzó no puede confirmarse.

## Integración B41/B42

- Nuevos eventos B41: reservation_rejected, reservation_cancelled y reservation_withdrawn.
- No duplicar cancellation_approved de B39: los eventos directos dependen de closure_kind; una cancelación aprobada por change request no se reclasifica.
- Nuevos eventos B42: reservation_rejected y reservation_withdrawn; reservation_cancelled se conserva para cancelaciones reales.

## Fuera de alcance

- No añadir un quinto reservation_status.
- No pagos, reembolsos, push ni deploy.
- Las notas administrativas de resolución quedan para un bloque posterior.

## Validación

- TypeScript, lint, tests completos, build y validate:repo.
- Cobertura B48: tenant/RBAC, locks, rechazo exacto, carrera confirmar/rechazar/retirar, confirmación tardía, B43, B30, B41, B42, Mi cuenta, Admin y regresión B39–B47.
