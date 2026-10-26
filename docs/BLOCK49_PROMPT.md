# BLOQUE 49 — Expiración de solicitudes de reserva PENDING vencidas

Continúa sobre B39–B48 cerrados. Corrige el estado operativo de solicitudes originales de reserva que siguen pending cuando su horario ya comenzó.

## Objetivo funcional

- Mantener los cuatro estados históricos de reserva.
- Añadir closure_kind=request_expiration para una solicitud original que venció sin confirmación.
- Una PENDING futura conserva Confirmar / Rechazar.
- Una PENDING con start_at menor o igual a now deja de ofrecer Confirmar/Rechazar y pasa a Expirar.
- Mi cuenta muestra Vencida mientras la fila aún está pending y Expirada cuando el cierre ya fue aplicado.
- Normalizar en la migración las PENDING public_web que ya estaban vencidas.

## Seguridad y concurrencia

- Nueva RPC admin_expire_pending_reservation(uuid).
- Actor y tenant derivados de phase6_admin_actor(); no aceptar user_id, business_id, estado ni rol desde el navegador.
- Lock reservation FOR UPDATE.
- Solo public_web + pending + start_at vencido.
- Exact retry únicamente para cancelled + request_expiration.
- Cualquier otro terminal devuelve conflicto.
- admin_reject_pending_reservation debe rechazar solicitudes vencidas con pending_reservation_expired_requires_expiration.
- Confirmar, rechazar, retirar y expirar serializan sobre la misma reserva: el primer terminal gana.
- Una PENDING vencida tampoco puede editarse para moverla a un horario futuro; admin_edit_reservation debe exigir que el horario original siga vigente.
- Endurecer la firma real usada por la app de admin_edit_reservation con p_net_height_cm smallint y eliminar el overload legacy con p_lighting para que no exista un bypass paralelo.
- No modificar registros de pago; B49 solo corrige el lifecycle de la reserva.

## B41 / B42

- Nuevo evento reservation_expired.
- Notificar al cliente vinculado cuando la solicitud expira.
- Auditar reservation_expired, no reservation_cancelled ni reservation_rejected.
- En el backfill de migración, actor de auditoría = system; en la RPC manual, actor = operador autenticado.

## UI

- /admin/reservas: badge Vencida y acción Expirar usando timestamp renderizado por servidor.
- Pizarra administrativa: mismo criterio temporal, sin ofrecer Confirmar/Rechazar a una solicitud vencida.
- Pizarra administrativa: ocultar también Editar cuando la solicitud ya venció.
- Mi cuenta recibe is_expired_pending desde PostgreSQL para no depender del reloj del navegador.

## Fuera de alcance

- No añadir cron ni automatización externa.
- No añadir un quinto reservation_status.
- No pagos, reembolsos, push ni deploy.
- Las notas de resolución siguen fuera de alcance.

## Validación

- TypeScript, lint, tests focales y completos, build y validate:repo.
- Cubrir tenant/RBAC/anon, stale vs future, exact retry, race safety, backfill, no mutación de pagos, B41/B42, Mi cuenta, Admin, tipos/repositorio/local parity y regresión B30/B41–B48.
- Verificar que la función interna del trigger de notificaciones no sea ejecutable directamente por anon/authenticated.
