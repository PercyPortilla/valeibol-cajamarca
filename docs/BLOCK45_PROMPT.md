# BLOQUE 45 — Retiro y expiración administrativa de propuestas

Continúa sobre B39–B44 cerrados. Implementa el retiro o expiración segura de una propuesta de reprogramación B44 pendiente por OWNER/ADMIN, sin mover ni cancelar la reserva original.

## Objetivo funcional

- OWNER/ADMIN puede retirar una propuesta iniciada por el negocio mientras siga pendiente.
- OWNER/ADMIN puede marcarla expirada cuando la reserva original o el horario propuesto ya no permiten una respuesta temporal válida.
- El servidor revalida el reloj al retirar: si venció después de renderizar la pantalla, Retirar debe fallar y exigir la ruta Expirar para no falsear auditoría.
- La reserva original conserva cancha, horario, estado y valor.
- El retiro libera el lifecycle pendiente para que la reserva vuelva a operar normalmente.
- Repetir el retiro de una propuesta ya retirada debe ser idempotente.
- Repetir la expiración de una propuesta ya expirada debe ser idempotente.
- El cliente recibe una notificación clara indicando que el negocio retiró la propuesta.
- Auditoría registra un evento propio de retiro.

## Modelo

- Conservar los estados existentes pending, approved y rejected.
- Añadir resolution_kind para distinguir customer_response, admin_resolution, business_withdrawal y business_expiration.
- Un retiro se representa como status rejected con resolution_kind business_withdrawal; así no se rompe el contrato histórico de B39–B44 y la semántica se conserva explícitamente.
- Una expiración se representa como status rejected con resolution_kind business_expiration.

## Seguridad y concurrencia

- Actor y tenant se derivan de phase6_admin_actor().
- Solo owner/admin pueden retirar o expirar.
- La propuesta debe pertenecer al tenant activo, ser reschedule, initiator_kind business y seguir pending.
- Locks en orden reservation -> reservation_change_requests.
- El guard B44 sigue impidiendo que admin apruebe o rechace como si fuera cliente; solo permite las excepciones business_withdrawal y business_expiration.
- Nunca aceptar business_id, user_id, rol ni status desde el navegador.

## Integración

- Panel admin muestra Retirar propuesta mientras aún puede responderse y Expirar propuesta cuando ya venció por tiempo.
- Mi cuenta deja de mostrar la propuesta al refrescar porque ya no está pending.
- B41 emite reschedule_proposal_withdrawn al cliente.
- B41 emite reschedule_proposal_expired cuando corresponde.
- B42 registra reschedule_proposal_withdrawn con actor OWNER/ADMIN.
- B42 registra reschedule_proposal_expired con actor OWNER/ADMIN.
- Tipos, runner SQL y validación de repositorio quedan sincronizados.

## Fuera de alcance

- No añadir pagos ni reembolsos.
- No modificar la reserva al retirar ni al expirar.
- No hacer deploy, push ni cambios remotos sin autorización explícita.

## Validación

- TypeScript, lint, suite completa, build y validación de repositorio.
- Test B45 para autorización tenant, lock ordering, idempotencia, expiración temporal, no mutación de reserva, guard B44, notificación, auditoría y UI.
