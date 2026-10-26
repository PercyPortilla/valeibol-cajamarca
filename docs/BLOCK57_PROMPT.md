# BLOQUE 57 — Paginación completa de Notificaciones admin

Continúa sobre B1–B56 cerrados. Elimina el límite silencioso de `/admin/notificaciones` sin alterar el centro del cliente, el estado leído/no leído por operador ni el lifecycle de reservas.

## Problema

La página administrativa cargaba `get_admin_notifications({ p_limit: 60 })` y la RPC histórica aplicaba un máximo de 100 filas. Un tenant con más actividad perdía acceso visual a notificaciones antiguas sin ninguna navegación posible.

## Objetivo

- Historial admin completo mediante paginación keyset server-side.
- Mantener la RPC B41 legacy para compatibilidad.
- Conservar estado de lectura individual por operador.
- Mantener tenant derivado del actor; nunca aceptar `business_id` ni `user_id` del navegador.
- No modificar el centro de notificaciones del cliente en este bloque.

## Implementación

- Nueva RPC `get_admin_notifications_page(limit,cursor_created_at,cursor_id)`.
- Keyset `(created_at,id)` DESC.
- Cursor all-or-none y límite server-side acotado.
- UI: 40 notificaciones por página y `limit + 1` para detectar la siguiente página.
- Navegación: `Ver notificaciones más antiguas →` y `Volver al inicio`.
- Una página cursor vacía se presenta como fin del historial y no como ausencia total de notificaciones.
- Índice parcial tenant + `created_at` + `id` para audiencia admin.

## Seguridad

- `SECURITY DEFINER` + `search_path=public,pg_temp`.
- `phase6_admin_actor()` deriva tenant y operador.
- Sin `p_business_id` ni `p_user_id`.
- `PUBLIC` y `anon` sin EXECUTE; `authenticated` usa la RPC bajo validación del actor.
- Las tablas privadas B41 siguen sin acceso directo de la app.

## Validación

- Contrato TS/SQL del cursor, tenant y privilegios.
- Caso sintético de 137 notificaciones para verificar recorrido completo más allá del hard-cap histórico de 100.
- Regresión B41 de estado leído/no leído.
- TypeScript, lint, validate:repo, seguridad, diff-check, suite completa y build.

La prueba SQL añadida es contractual/estática salvo ejecución explícita contra una base real. No afirmar migración aplicada ni SQL E2E remoto si no se ejecutó.

## Fuera de alcance

- No paginar notificaciones del cliente en B57.
- No cambiar eventos B41 ni agregar nuevos tipos.
- No cambiar reservas, pagos ni lifecycle.
- No push, commit, deploy ni migración remota.
