# BLOQUE 58 — Paginación completa de Notificaciones del cliente

Continúa sobre B1–B57 cerrados. Elimina el límite silencioso del centro de notificaciones de `Mi cuenta` sin alterar reservas, change requests ni el estado leído/no leído de B41.

## Problema

`/mi-cuenta` cargaba `get_my_notifications({ p_limit: 40 })` y la RPC histórica aplicaba un máximo de 100 filas. Un cliente con suficiente actividad perdía acceso visual a notificaciones antiguas sin navegación posible.

## Objetivo

- Historial completo del cliente mediante paginación keyset server-side.
- Mantener `get_my_notifications(integer)` para compatibilidad.
- Mantener identidad derivada exclusivamente de `auth.uid()`.
- Conservar estado leído/no leído y las acciones individuales/globales de B41.
- No tocar el centro de notificaciones admin de B57.

## Implementación

- Nueva RPC `get_my_notifications_page(limit,cursor_created_at,cursor_id)`.
- Keyset `(created_at,id)` DESC.
- Cursor all-or-none y límite server-side acotado.
- UI: 40 notificaciones por página y `limit + 1` para detectar otra página.
- Navegación: `Ver notificaciones más antiguas →` y `Volver al inicio`.
- Una página cursor vacía se muestra como fin del historial, no como una cuenta sin actividad.
- Índice parcial `recipient_user_id + created_at + id` para audiencia customer.

## Seguridad

- `SECURITY DEFINER` + `search_path=public,pg_temp`.
- Identidad únicamente desde `auth.uid()` y cuenta activa.
- Sin `p_user_id` ni `p_business_id`.
- `PUBLIC` y `anon` sin EXECUTE; `authenticated` puede ejecutar solo para su propia identidad.
- Las tablas B41 siguen privadas.

## Validación

- Contrato TS/SQL de identidad, cursor y privilegios.
- Caso sintético con 143 notificaciones para recorrer más del hard-cap histórico de 100 sin omisiones ni duplicados.
- Regresión B41 de lectura individual y marcar todas.
- TypeScript, lint, validate:repo, seguridad, diff-check, suite completa y build.

La prueba SQL añadida es contractual/estática salvo ejecución explícita contra una base real. No afirmar migración aplicada ni SQL E2E remoto si no se ejecutó.

## Fuera de alcance

- No tocar notificaciones admin.
- No cambiar tipos de evento B41.
- No cambiar reservas, pagos ni lifecycle.
- No push, commit, deploy ni migración remota.
