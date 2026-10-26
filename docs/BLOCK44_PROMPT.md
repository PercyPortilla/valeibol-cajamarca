# BLOQUE 44 — Propuesta de reprogramación iniciada por el negocio

Continúa sobre B39–B43 cerrados. Implementa una reprogramación propuesta por OWNER/ADMIN que el cliente debe aceptar o rechazar desde Mi cuenta, reutilizando reservation_change_requests y sin crear un lifecycle paralelo.

## Objetivo funcional

- OWNER/ADMIN puede proponer nueva cancha, fecha y horario para una reserva confirmed futura.
- La reserva original permanece intacta mientras la propuesta está pending.
- Solo un cliente con cuenta vinculada puede recibir y responder la propuesta.
- El cliente ve en Mi cuenta el horario actual, la cancha y horario propuestos, el valor estimado y la nota opcional del negocio.
- El cliente puede aceptar o rechazar.
- Al aceptar, el servidor revalida cancha compatible, horario operativo, granularidad, iluminación, pricing, disponibilidad y compatibilidad con pagos reportados o verificados antes de mover la reserva.
- Al rechazar, la reserva original permanece sin cambios.
- Un reintento idéntico de la misma propuesta pendiente devuelve la solicitud existente; una propuesta distinta mientras exista otra pendiente produce conflicto.

## Seguridad y concurrencia

- El navegador nunca envía business_id, user_id, rol ni precio autoritativo.
- OWNER/ADMIN se deriva de phase6_admin_actor().
- El cliente se deriva exclusivamente de auth.uid() y debe coincidir con reservation.user_id y reservation_change_requests.user_id.
- Los locks conservan el orden reservation -> reservation_change_requests, compatible con B39–B43.
- La exclusión y el ledger de agenda siguen siendo la barrera final contra doble reserva.
- OWNER/ADMIN no puede resolver su propia propuesta mediante el resolver administrativo; una propuesta con initiator_kind=business solo puede pasar a approved/rejected mediante la respuesta del cliente.
- Sigue existiendo una sola solicitud o propuesta pending por reserva.

## Integración

- Extiende reservation_change_requests con initiator_kind, initiated_by y proposal_note.
- Extiende lecturas cliente/admin con origen de la solicitud y nombre de cancha propuesta.
- B41 añade los eventos reschedule_proposed, reschedule_proposal_accepted y reschedule_proposal_rejected.
- B42 audita propuesta y respuesta con actor correcto, sin duplicar PII.
- El panel admin muestra propuestas pendientes como “Esperando respuesta del cliente” y no ofrece aprobar/rechazar.
- Mi cuenta separa solicitudes iniciadas por cliente de propuestas iniciadas por negocio.

## Fuera de alcance

- No añadir pasarela ni UI nueva de pagos.
- No cancelar ni reembolsar pagos automáticamente.
- No permitir propuestas a reservas no vinculadas a una cuenta cliente.
- No hacer commit, push, deploy ni cambios remotos sin autorización explícita.

## Validación

- Ejecutar TypeScript, lint, tests, validación de repositorio y build.
- Incluir test B44 para autorización, orden de locks, idempotencia, revalidación de quote/disponibilidad, guard contra autoaprobación, UI, notificaciones y auditoría.
- Añadir SQL contract test al runner local/CI, sin ejecutarlo sobre infraestructura remota.
