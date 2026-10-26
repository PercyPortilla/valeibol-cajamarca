# BLOQUE 51 — Historial administrativo paginado y filtrado en servidor

Continúa sobre B39–B50 cerrados. Corrige la pérdida silenciosa de reservas históricas causada por aplicar un LIMIT global antes de separar las vistas administrativas.

## Problema

`/admin/reservas` pedía hasta 200 filas con `get_admin_reservation_requests` y después filtraba en la aplicación por activas, completadas, canceladas o archivadas. Con más de 200 reservas recientes, una vista histórica podía aparecer vacía o incompleta aunque existieran registros válidos del tenant.

## Objetivo

- Filtrar la vista dentro de PostgreSQL antes de LIMIT.
- Paginar con cursor keyset estable, no OFFSET.
- Conservar el scope del tenant resuelto por `phase6_admin_actor()`.
- No aceptar `business_id` desde navegador.
- Mantener lectura para los mismos roles administrativos ya autorizados.
- Mantener compatibilidad del RPC histórico para otros consumidores.

## Backend autoritativo

- Añadir `get_admin_reservations_page(p_view, p_limit, p_cursor_start_at, p_cursor_created_at, p_cursor_id)`.
- Vistas válidas: `active`, `completed`, `cancelled`, `archived`.
- Semántica:
  - active: no archivada + pending/confirmed.
  - completed: no archivada + completed.
  - cancelled: no archivada + cancelled.
  - archived: archived_at no nulo.
- Orden determinista: `start_at desc, created_at desc, id desc`.
- Cursor: misma tupla `(start_at, created_at, id)`.
- Cursor completo o ausente; cursores parciales se rechazan.
- Límite acotado; el repositorio pide una fila extra para detectar página siguiente.
- Seguridad: `SECURITY DEFINER`, `search_path` fijo, tenant de `phase6_admin_actor()`, anon sin EXECUTE, authenticated con EXECUTE.

## Repositorios/UI

- Añadir `listPage()` al contrato de reservas admin.
- Supabase usa el nuevo RPC.
- Modo local replica filtros, orden y cursor.
- `/admin/reservas` deja de hacer `list(200)` + filtro posterior.
- Tamaño de página: 40.
- Enlace `Ver más antiguas` avanza por keyset.
- `Volver al inicio` limpia el cursor.
- Cambiar de vista siempre reinicia la paginación.

## Validación

- Caso de más de 200 reservas de otra vista sin starvation.
- Completed/archived siguen visibles y paginables.
- Cursor sin duplicados en dataset estable.
- Tenant derivado del actor, sin business_id del navegador.
- Privilegios correctos.
- TypeScript, lint, suite completa, build, validate:repo y git diff --check.

## Fuera de alcance

- No cambiar lifecycle B39–B50.
- No cambiar pagos.
- No añadir no-show.
- No implementar resolution_note en este bloque.
- No push ni deploy.
