# BLOQUE 46 — Expiración de solicitudes de cambio iniciadas por cliente

Continúa sobre B39–B45 cerrados. Corrige el lifecycle de solicitudes de cancelación/reprogramación iniciadas por el cliente que permanecen pendientes cuando ya no pueden resolverse por tiempo.

## Objetivo funcional

- Una solicitud customer-origin pending se considera expirable cuando la reserva ya no está confirmed, el horario original ya empezó, o en reprogramación el horario solicitado ya pasó/no es válido.
- OWNER/ADMIN puede usar Expirar solicitud.
- Expirar no modifica la reserva.
- Una solicitud expirada deja de bloquear el lifecycle B43 porque ya no permanece pending.
- Cancelación tardía no puede aprobarse después del inicio de la reserva.
- Reprogramación tardía no puede aprobarse si el destino solicitado ya quedó en el pasado.
- Mi cuenta distingue expirado de rechazado.

## Modelo

- Mantener status pending/approved/rejected.
- Añadir semántica resolution_kind=customer_expiration para customer-origin + rejected.
- Mantener admin_resolution, customer_response, business_withdrawal y business_expiration de B45.
- Exact retry de admin_resolve solo puede ser idempotente cuando resolution_kind=admin_resolution; una expiración previa debe devolver already_resolved.

## Seguridad y concurrencia

- Actor/tenant desde phase6_admin_actor().
- Solo OWNER/ADMIN pueden expirar.
- Request debe pertenecer al tenant activo y ser initiator_kind=customer.
- Lock ordering reservation -> change_request.
- No recibir business_id, user_id, rol, status ni resolution_kind desde navegador.
- Expiración nunca actualiza reservations.

## Integración

- Admin muestra Expirar solicitud en lugar de Aprobar/Rechazar cuando el request ya venció.
- Mi cuenta recibe resolution_kind desde get_my_reservation_change_requests y comunica expiración correctamente.
- B41 genera cancellation_expired o reschedule_expired para el cliente.
- B42 registra los mismos eventos con actor OWNER/ADMIN.
- Tipos Supabase, SQL runner y validación de repositorio quedan sincronizados.

## Fuera de alcance

- No implementar todavía desistimiento voluntario del cliente; queda como candidato para el siguiente bloque.
- No pagos, reembolsos, push ni deploy.

## Validación

- TypeScript, lint, tests completos, build y validate:repo.
- Cobertura B46: tenant/roles, lock ordering, condición temporal, idempotencia exacta, no mutación de reserva, UI admin/cliente, notificaciones, auditoría y regresión B39–B45.
