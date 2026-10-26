# BLOQUE 47 — Retiro por el cliente de su solicitud pendiente

Continúa sobre B39–B46 cerrados. Permite que un cliente autenticado retire o desista de su propia solicitud pendiente de cancelación o reprogramación, sin tocar la reserva original.

## Objetivo funcional

- El cliente puede retirar únicamente una solicitud customer-origin propia que siga pending.
- El retiro solo aplica mientras la solicitud siga temporalmente vigente; una solicitud ya vencida conserva la semántica de expiración de B46.
- El retiro no cancela, mueve ni modifica la reserva.
- Tras retirar, el request deja de bloquear B43 y libera el índice de un único cambio pendiente.
- Si la reserva sigue confirmada y futura, Mi cuenta puede volver a ofrecer una nueva solicitud según los flags autoritativos del servidor.
- Mi cuenta distingue retirada por el cliente de rechazada y expirada.

## Modelo

- Mantener pending, approved y rejected.
- Añadir resolution_kind customer_withdrawal para customer-origin + rejected.
- Conservar admin_resolution, customer_expiration, customer_response, business_withdrawal y business_expiration.

## Seguridad y concurrencia

- Identidad exclusiva desde auth.uid().
- Exigir user_accounts.is_active.
- El request debe tener user_id igual a auth.uid() e initiator_kind customer.
- La reserva debe pertenecer al mismo usuario autenticado.
- Lock order global: reservation FOR UPDATE -> reservation_change_requests FOR UPDATE.
- Exact retry solo si ya quedó rejected + customer_withdrawal + resolved_by igual a auth.uid().
- Si la reserva original ya empezó o el destino de una reprogramación ya quedó en el pasado, el servidor exige la ruta de expiración y no registra un retiro tardío.
- Si Admin/Owner resolvió o expiró primero, el retiro devuelve already_resolved; si el cliente retiró primero, los flujos admin tampoco deben confundirlo con su propia idempotencia.
- Nunca recibir business_id, user_id, rol, status ni resolution_kind desde navegador.

## Integración

- Mi cuenta muestra Retirar solicitud solo en cancelación o reprogramación pending todavía vigente; si ya venció, informa que está pendiente de cierre por el negocio.
- La vigencia del botón se calcula en PostgreSQL mediante can_withdraw_request; la página no usa su propio reloj para decidir autorización.
- B41 emite cancellation_withdrawn o reschedule_withdrawn para audiencia admin, sin falso evento rejected.
- B42 registra el evento correspondiente con actor explícito customer.
- Tipos Supabase, runner SQL y validación del repositorio quedan sincronizados.

## Fuera de alcance

- No modificar la reserva al retirar.
- No pagos, reembolsos, push ni deploy.

## Validación

- TypeScript, lint, tests completos, build y validate:repo.
- Cobertura B47: ownership, cuenta activa, lock ordering, no mutación de reserva, idempotencia exacta, carreras con resolve/expire, UI, notificaciones, auditoría y regresión B39–B46.
