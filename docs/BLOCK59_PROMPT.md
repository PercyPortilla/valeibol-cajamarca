# BLOQUE 59 — Paginación de solicitudes de cambio pendientes en Admin

Continúa sobre B1–B58 cerrados. Corrige el desacople restante entre la paginación B51 de reservas y el panel de solicitudes de cambio, sin alterar lifecycle ni decisiones de negocio.

## Problema

`/admin/reservas` ya pagina reservas, pero en la vista activa seguía ejecutando `get_admin_reservation_change_requests()` sin límite. Esa RPC devuelve pendientes y resueltas de todo el tenant, mientras el componente filtra y renderiza únicamente `pending`. El costo crece con todo el historial y puede degradar cada render operativo.

Además, no basta con limitar el array del panel: las tarjetas de reservas necesitan saber si una reserva visible tiene un cambio pendiente para no ofrecer una nueva propuesta de reprogramación de forma engañosa.

## Objetivo

- Paginar exclusivamente solicitudes pendientes del tenant.
- Mantener acceso a todas las pendientes mediante navegación, no mediante truncamiento.
- Mantener `hasPendingChange` exacto para las reservas visibles de B51.
- Mantener la RPC legacy para compatibilidad, pero retirar su uso de la UI operativa.

## Implementación

- Nueva RPC `get_admin_pending_reservation_change_requests_page(limit,cursor_created_at,cursor_id)`.
- Filtro `status='pending'` y tenant antes de `LIMIT`.
- Keyset `(created_at,id)` DESC, ambas claves inmutables.
- 20 solicitudes por página y `limit + 1` para detectar siguiente página.
- Paginación independiente del panel de reservas: `Ver solicitudes más antiguas →` / `Volver al inicio de solicitudes`.
- Nueva RPC mínima `get_admin_pending_change_reservation_ids(uuid[])` para las reservas visibles, máximo 100 IDs, sin devolver PII.
- Índice parcial tenant + `created_at` + `id` para solicitudes `pending`.

## Seguridad

- Ambas RPC derivan actor/tenant con `phase6_admin_actor()`.
- Sin `p_business_id` ni actor suministrado por navegador.
- `SECURITY DEFINER` con `search_path=public,pg_temp`.
- `PUBLIC` y `anon` sin EXECUTE; `authenticated` sujeto a validación del actor.
- El helper de flags solo devuelve IDs de reservas solicitadas que realmente tienen un pending dentro del tenant activo.

## Compatibilidad

- No cambia estados, `resolution_kind`, `closure_kind` ni locks B43.
- No modifica aprobación/rechazo/expiración/retiro de B39–B47.
- No cambia B51 ni la paginación de reservas.
- La RPC histórica `get_admin_reservation_change_requests()` permanece disponible para compatibilidad.

## Validación

- Contrato SQL/TS de tenant, filtro pending, cursor y privilegios.
- Caso sintético con 127 pendientes y 450 resueltas: todas las pendientes deben recorrerse sin omisiones ni duplicados.
- Regresiones B39, B40, B44, B45, B46, B47 y B51.
- TypeScript, lint, validate:repo, seguridad, diff-check, suite completa y build.

La prueba SQL añadida es contractual/estática salvo ejecución explícita contra una base real. No afirmar migración aplicada ni SQL E2E remoto si no se ejecutó.

## Fuera de alcance

- No cambiar lifecycle de reservas o change requests.
- No tocar pagos.
- No paginar Mi cuenta en este bloque.
- No push, commit, deploy ni migración remota.
