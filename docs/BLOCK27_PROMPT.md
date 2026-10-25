# BLOQUE 27 — Catálogo global de deportes dinámico

## Objetivo

Eliminar la dependencia funcional del marketplace respecto de un listado fijo de cuatro deportes, reutilizando la tabla global `public.sports` ya existente y manteniendo compatibilidad con Vóley, Fútbol, Futsal y Básquet.

## Base de datos

- `get_public_sports()` expone únicamente deportes activos y ordenados.
- `get_platform_admin_sports()` devuelve el catálogo completo y conteos de canchas solo a ADMIN global.
- `platform_admin_upsert_sport(...)` crea o edita deportes con validación de slug, nombre, icono y orden.
- `platform_admin_set_sport_active(...)` activa/desactiva deportes.
- No se puede desactivar un deporte mientras tenga canchas activas (`sport_has_active_courts`).
- `anon` y `authenticated` no reciben DML directo sobre `public.sports`.
- Las mutaciones globales revalidan `is_platform_admin()` dentro de PostgreSQL.

## Marketplace público

- Home, selector de búsqueda y sitemap leen deportes desde Supabase.
- El fallback local conserva los cuatro deportes iniciales para desarrollo sin Supabase.
- Las rutas históricas `/voley`, `/futbol`, `/futsal` y `/basquet` se conservan.
- Los deportes nuevos usan `/deportes/[slug]`.
- La landing genérica deriva nombre, título, descripción y metadata del deporte real.
- Una landing solo es indexable/canonical cuando existe inventario público real.

## Booking

- La regla histórica de altura de red sigue siendo exclusiva de `voley`.
- Deportes nuevos se consideran sin altura de red salvo que un bloque futuro diseñe una regla explícita adicional.
- B27 no reescribe reservas existentes ni cambia tarifas, horarios o disponibilidad.

## Administración global

- `ADMIN global` puede crear, editar, activar y desactivar deportes desde `/admin-global`.
- Owner/Admin/Staff de tenant no administran el catálogo global; solo pueden seleccionar deportes activos al crear canchas mediante el flujo B20 existente.
- La UI muestra número de canchas totales y activas por deporte.
- Feedback, busy states y controles táctiles mantienen los criterios accesibles existentes.

## Límites

- No hay deploy, push, commit ni migración remota en este bloque.
- La ejecución SQL E2E local sigue condicionada a Docker/virtualización del equipo; no debe declararse PASS si no se ejecutó PostgreSQL real.
