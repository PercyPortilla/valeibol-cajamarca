# BLOQUE 54 — Consistencia de cierre tras cancelación confirmada

Continúa sobre B39–B53 cerrados. Corrige la única ruta que todavía podía dejar una reserva `cancelled` sin la causa terminal definida en B48.

## Problema

B48 estableció que una reserva que ya había sido confirmada y luego se cancela debe usar `closure_kind='confirmed_cancellation'`. La cancelación administrativa directa ya lo hacía. Sin embargo, `admin_resolve_reservation_change_request` —cuando OWNER/ADMIN aprobaba una solicitud de cancelación iniciada por el cliente— cambiaba solo `status='cancelled'` y dejaba `closure_kind` nulo.

Esto hacía que dos formas equivalentes de cancelar una reserva confirmada produjeran estados persistidos distintos y debilitaba la idempotencia semántica de B48/B52.

## Objetivo

- Una solicitud customer-origin de cancelación aprobada debe cerrar la reserva como `confirmed_cancellation`.
- Reintentar la misma aprobación solo es éxito exacto si la reserva sigue `cancelled + confirmed_cancellation` y coincide decisión+nota.
- No cambiar el comportamiento de reprogramación.
- No generar dos notificaciones al cliente por la misma aprobación.
- Clasificar registros históricos inequívocos sin inventar causas ambiguas.

## Implementación

- `admin_resolve_reservation_change_request` conserva autorización, tenant y lock order de B52.
- En aprobación de `request_type='cancellation'` escribe atómicamente:
  - `status='cancelled'`;
  - `closure_kind='confirmed_cancellation'`;
  - actor y `status_changed_at`.
- La idempotencia terminal de B52 además verifica el cierre consistente cuando el request aprobado es de cancelación.
- La cancelación se hace en dos UPDATE dentro de la misma transacción: primero `status='cancelled'`; después `closure_kind='confirmed_cancellation'`.
- El trigger B41 escucha `status/user_id`, no un UPDATE exclusivo de `closure_kind`, así que la primera transición mantiene el comportamiento previo y no emite `reservation_cancelled` genérico porque todavía no tiene esa causa; el segundo UPDATE no vuelve a dispararlo.
- El UPDATE posterior del change request continúa generando el evento específico `cancellation_approved`.
- B49 sí escucha `closure_kind`, pero su trigger exclusivo de expiración exige `old.status='pending'` y `request_expiration`; por tanto el segundo UPDATE de B54 no genera eventos falsos.
- Cancelaciones administrativas directas siguen haciendo `status + closure_kind` juntos y conservan su `reservation_cancelled`.
- Backfill solo actualiza reservas `cancelled` con `closure_kind is null` cuando existe un change request del mismo usuario/tenant, customer-origin, cancellation, approved y `admin_resolution`.

## Seguridad

- No se recibe `business_id` ni `user_id` del navegador.
- Actor derivado por `phase6_admin_actor()`.
- Solo OWNER/ADMIN resuelve.
- Orden de locks: reserva → change request.
- RPC y trigger functions siguen sin EXECUTE público/anónimo.

## Validación

- Contrato TS focal B54.
- Contrato SQL de closure, idempotencia y dedupe de notificación.
- Regresiones B39/B40/B43/B48/B52.
- TypeScript, lint, validate:repo, `git diff --check`, suite completa y build.

## Fuera de alcance

- No crear otro reservation status.
- No cambiar pagos.
- No cambiar propuestas business-origin.
- No push, commit ni deploy.
