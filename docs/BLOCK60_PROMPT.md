# BLOQUE 60 — Paginación del historial de reservas en Mi cuenta

Continúa sobre B1–B59 cerrados. Corrige la carga ilimitada del historial del cliente sin alterar lifecycle, capacidades autoritativas ni las acciones de solicitudes de cambio.

## Problema

`/mi-cuenta` seguía ejecutando `get_my_reservations()` y `get_my_reservation_change_requests()` completos. A medida que una cuenta acumula reservas y solicitudes, cada render descarga todo el historial aunque solo una fracción sea necesaria en pantalla.

## Objetivo

- Paginar reservas propias con cursor estable e inmutable.
- Mantener todos los campos y capacidades derivadas por PostgreSQL.
- Cargar solo los últimos change requests relevantes para las reservas visibles.
- Mantener identidad exclusivamente desde `auth.uid()`.

## Implementación

- Nueva RPC `get_my_reservations_page(limit,cursor_created_at,cursor_id)`.
- Keyset `(created_at,id)` DESC; no usa `start_at` como cursor porque puede cambiar por reprogramación.
- 20 reservas por página y `limit + 1` para detectar siguiente página.
- Nueva RPC `get_my_latest_reservation_change_requests(uuid[])`:
  - máximo 100 IDs;
  - exige ownership del usuario autenticado;
  - devuelve el último request por `reservation_id + request_type + initiator_kind`;
  - conserva `can_withdraw_request` server-side.
- Navegación independiente de notificaciones: `Ver reservas más antiguas →` y `Volver al inicio de reservas` preservan la página de notificaciones actual, y viceversa.
- Índice `user_id + created_at + id` para historial propio.

## Compatibilidad

- Mantener RPC legacy `get_my_reservations()` y `get_my_reservation_change_requests()` para compatibilidad.
- Preservar `can_withdraw`, `can_request_cancellation`, `can_request_reschedule`, `closure_kind` e `is_expired_pending`.
- No cambiar B30, B39, B40, B44, B46, B47, B48 ni B49.
- No cambiar pagos ni estados.

## Seguridad

- `SECURITY DEFINER` con `search_path=public,pg_temp`.
- Identidad únicamente desde `auth.uid()` y cuenta activa.
- Sin `p_user_id` ni `p_business_id`.
- `PUBLIC` y `anon` sin EXECUTE; `authenticated` sujeto a ownership real.

## Validación

- Contrato SQL/TS de identidad, cursor, privilegios y capacidades.
- Caso sintético con 151 reservas para verificar recorrido completo sin omisiones/duplicados.
- Regresiones de Mi cuenta, B30, B31, B39, B40, B44, B46, B47, B48 y B49.
- TypeScript, lint, validate:repo, seguridad, diff-check, suite completa y build.

La prueba SQL añadida es contractual/estática salvo ejecución explícita contra una base real. No afirmar migración aplicada ni SQL E2E remoto si no se ejecutó.

## Fuera de alcance

- No paginar reseñas/favoritos en B60.
- No cambiar lifecycle ni pagos.
- No push, commit, deploy ni migración remota.
