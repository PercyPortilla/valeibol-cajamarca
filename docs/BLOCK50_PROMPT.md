# BLOQUE 50 — Inmutabilidad de solicitudes public_web PENDING

Continúa sobre B39–B49 cerrados. Corrige el último bypass de edición silenciosa de una solicitud original enviada por un cliente desde la web pública.

## Problema

Una reserva pending con source=public_web representa exactamente lo que el cliente solicitó. Antes de B50, OWNER/ADMIN todavía podía abrir Editar en la pizarra y modificar cancha, horario, altura, tarifa, total o datos del cliente antes de confirmar. El cliente no aprobaba esa modificación y no existía una notificación específica de ese cambio.

## Objetivo

- Una PENDING public_web futura es inmutable.
- Sus únicas decisiones administrativas son Confirmar o Rechazar.
- Si ya venció, B49 conserva Expirar.
- Una PENDING interna (admin, phone, whatsapp, other) futura sigue siendo editable por OWNER/ADMIN.
- CONFIRMED sigue usando el workflow B39–B47 para cambios; no reabrir edición directa.

## Backend autoritativo

- Reutilizar la firma real admin_edit_reservation(uuid,uuid,date,time,time,smallint,text,text).
- Derivar actor/tenant mediante phase6_admin_actor().
- Bloquear la reserva FOR UPDATE.
- Orden de guards:
  1. CONFIRMED → confirmed_reschedule_requires_request.
  2. No PENDING → reservation_not_editable.
  3. PENDING vencida → pending_reservation_expired_requires_expiration.
  4. PENDING public_web futura → public_pending_request_not_editable.
- Solo después de esos guards se permite recalcular y actualizar una PENDING interna.
- Mantener DML encapsulado; anon sin EXECUTE.

## UI

- En AdminScheduleBoard, ocultar Editar cuando entry.source sea public_web.
- Mantener Confirmar/Rechazar para PENDING pública futura.
- Mantener Expirar para PENDING pública vencida.
- Mantener Editar para PENDING interna futura.
- Mapear el error autoritativo a un mensaje claro por si la UI está desactualizada o existe una carrera.

## Auditoría/notificaciones

- B50 no crea un evento nuevo: la operación queda rechazada antes de cualquier UPDATE.
- No debe producir falsos reservation_details_updated, reservation_rescheduled ni notificaciones por un intento bloqueado.

## Validación

- Tests B50 de tenant/lock/orden de guards/privilegios.
- Public web futura no editable.
- Public web stale conserva Expirar B49.
- CONFIRMED conserva B40.
- PENDING interna futura sigue editable.
- Paridad local, feedback, UI y ausencia de eventos espurios.
- TypeScript, lint, suite completa, build, validate:repo y git diff --check.

## Fuera de alcance

- No cambiar pagos.
- No añadir no-show.
- No implementar resolution_note en UI en este bloque.
- No push ni deploy.
