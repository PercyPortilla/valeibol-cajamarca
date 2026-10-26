# BLOQUE 55 — Paginación completa del panel Clientes

Continúa sobre B1–B54 cerrados. Elimina los límites silenciosos de `/admin/clientes` sin alterar la privacidad, tenant scope ni lifecycle de reservas.

## Problema

La página cargaba `listCustomers(200)` y, al seleccionar uno, `getCustomerHistory(..., 100)`. Ambas RPC históricas tenían `LIMIT`, por lo que un tenant con más de 200 clientes podía perder acceso a clientes antiguos y un cliente con más de 100 reservas podía mostrar un historial incompleto sin avisarlo.

## Objetivo

- Directorio completo mediante paginación keyset server-side.
- Historial completo de cada cliente mediante paginación keyset.
- Seleccionar un cliente por ID debe funcionar aunque no pertenezca a la página actual del directorio.
- Conservar PII solo dentro del panel administrativo protegido.
- Conservar tenant derivado del actor; nunca aceptar `business_id` desde navegador.
- Paridad local.

## Implementación

- `get_admin_customers_page(limit,cursor_created_at,cursor_id)` filtra tenant y clientes activos antes del límite y usa keyset inmutable `(customer_created_at, customer_id)` DESC.
- `get_admin_customer_summary(customer_id)` resuelve el cliente seleccionado dentro del tenant independientemente de la página visible.
- `get_admin_customer_history_page(customer_id,limit,cursor...)` valida ownership y usa keyset inmutable `(created_at,id)` DESC.
- UI: 30 clientes por página y 25 reservas por página de historial.
- Modo local implementa el mismo contrato y orden.
- Los cursores no dependen de `last_activity_at` ni `start_at`, por lo que una edición o reprogramación no mueve filas a través del cursor y no provoca omisiones/duplicados.
- Si un cursor antiguo ya no devuelve filas, la UI conserva un cliente seleccionado válido y ofrece volver al inicio en lugar de fingir que el tenant no tiene clientes.
- Si `cliente=` apunta a un registro archivado, eliminado o ajeno al tenant, el `not_found` se trata como selección stale: el directorio sigue operativo y ofrece limpiar la selección.

## Seguridad

- SECURITY DEFINER + `search_path=public,pg_temp`.
- Sin `p_business_id`.
- PII no se mueve a superficies públicas.
- `PUBLIC` y `anon` sin EXECUTE; `authenticated` entra por RPC y el actor administrativo valida el tenant.

## Validación

- Caso local con >200 clientes debe poder recorrerlos todos sin duplicados.
- Caso local con >100 reservas de un mismo cliente debe poder recorrerlas todas.
- Contratos TS/SQL de cursores, tenant y privilegios.
- Regresiones Phase 7 existentes.
- TypeScript, lint, validate:repo, diff-check, suite completa y build.

## Fuera de alcance

- No introducir búsqueda avanzada ni CRM.
- No cambiar estados/lifecycle de reservas.
- No cambiar pagos.
- No push, commit ni deploy.
