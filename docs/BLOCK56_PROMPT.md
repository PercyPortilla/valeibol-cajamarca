# BLOQUE 56 — Paginación completa del historial de auditoría de reservas

Continúa sobre B1–B55 cerrados. Elimina el límite silencioso del historial append-only de una reserva sin alterar lifecycle, privacidad ni tenant scope.

## Problema

`/admin/reservas/[id]/historial` cargaba `get_admin_reservation_audit(..., p_limit: 150)`, mientras la RPC histórica topeaba cualquier lectura a 200 filas. Una reserva con más de 150 eventos mostraba un historial incompleto sin advertencia y no existía forma de navegar a eventos más antiguos.

## Objetivo

- Historial completo mediante paginación keyset server-side.
- Mantener la RPC legacy para compatibilidad con código existente.
- Mantener `resolution_note` de B52 sin duplicar free-text dentro del ledger append-only.
- Mantener actor categórico y sin PII.
- Mantener tenant derivado del actor; nunca aceptar `business_id` desde navegador.

## Implementación

- Nueva RPC `get_admin_reservation_audit_page(reservation_id,limit,cursor_created_at,cursor_event_sequence)`.
- Keyset inmutable `(created_at,event_sequence)` DESC. Ambos campos pertenecen al ledger append-only y no se modifican después de insertar el evento.
- Validación all-or-none del cursor.
- UI: 50 eventos por página y `limit + 1` para detectar si existe otra página.
- Navegación: `Ver eventos más antiguos →` y `Volver al inicio del historial`.
- Un cursor válido sin resultados muestra un estado específico y no se confunde con una reserva sin eventos.
- Índice tenant/reserva/cursor para sostener la lectura paginada.

## Seguridad

- `SECURITY DEFINER` + `search_path=public,pg_temp`.
- La reserva se valida dentro del tenant antes de leer eventos.
- Sin `p_business_id`.
- Sin `actor_user_id`, teléfono, email, nombre de cliente u otra PII en el resultado.
- `PUBLIC` y `anon` sin EXECUTE; `authenticated` entra por RPC y `phase6_admin_actor()` resuelve el tenant.

## Validación

- Contrato TS de RPC y cursor.
- Contrato SQL estático de tenant, keyset y privilegios.
- Regresión sintética con 235 eventos para demostrar que el algoritmo de cursor atraviesa más de 200 filas sin duplicar ni omitir.
- Regresiones B42/B52.
- TypeScript, lint, validate:repo, diff-check, suite completa y build.

La validación SQL de este bloque es contractual/estática salvo que se ejecute explícitamente contra una base real. No afirmar SQL E2E remoto si la migración no fue aplicada.

## Fuera de alcance

- No cambiar estados ni semántica de lifecycle.
- No cambiar los triggers append-only existentes.
- No modificar pagos.
- No push, commit, deploy ni migración remota.
