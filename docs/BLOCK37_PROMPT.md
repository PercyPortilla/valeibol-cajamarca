# BLOQUE 37 — Vinculación segura de reservas no asociadas a Mi cuenta

Continúa sobre B20–B36 cerrados salvo regresión real. B37 permite recuperar una reserva pública creada como invitado o una solicitud cuya vinculación automática falló, sin usar el ID público como prueba de propiedad.

## Contrato de seguridad

- `request_token` ya es un UUID aleatorio generado en el navegador y persistido con la reserva; B37 lo trata como secreto de posesión.
- El `request_id` sigue siendo una referencia pública y nunca basta para reclamar una reserva.
- Nueva RPC `claim_public_reservation(p_request_token uuid)` deriva exclusivamente el usuario desde `auth.uid()`; no acepta `user_id`, `business_id`, teléfono ni nombre.
- Solo `authenticated` puede ejecutar la RPC; `anon` no.
- La reserva debe ser `source='public_web'` y coincidir exactamente con el token.
- La fila se bloquea `FOR UPDATE` para serializar claims concurrentes.
- Si ya pertenece a otra cuenta se devuelve el mismo error genérico que para un token inexistente.
- Si ya pertenece a la misma cuenta, la operación es idempotente.
- El customer relacionado se vincula cuando es compatible; una colisión del customer consolidado no revierte la vinculación de la reserva.

## UX

- Tras crear una reserva no vinculada, mostrar `Código secreto de recuperación` separado del `ID de solicitud`.
- En `Mi cuenta`, el cliente autenticado puede usar `Vincular una reserva anterior`.
- El formulario acepta solo el código secreto y refresca el historial después del éxito.
- Los errores no revelan si el código existe o si ya pertenece a otra cuenta.

## Límites

- No buscar reservas por teléfono, nombre o ID público.
- No mover una reserva entre dos cuentas.
- No tocar estados, importes, pagos, ownership, publicación ni multi-tenant.
- No hacer commit, push, deploy ni cambios remotos sin autorización explícita.

## Validación

1. `git diff --check`.
2. `npm run typecheck`.
3. `npm run lint`.
4. Tests focales B37 + customer-account + customer-withdrawal/contact.
5. `npm test`.
6. `npm run validate:supabase-security`.
7. `npm run qa`.
8. `npm run validate:repo`.
9. `npm run build`.
10. `npm audit --audit-level=moderate`.

