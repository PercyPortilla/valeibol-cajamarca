# BLOQUE 53 — Exportación administrativa completa sin truncamiento

Continúa sobre B39–B52 cerrados. Corrige el riesgo de pérdida silenciosa de filas al generar el XLSX administrativo.

## Problema

- La exportación de producción hacía una única llamada a `get_admin_export_reservations`.
- La API tiene un máximo de filas por respuesta, por lo que un periodo con muchas reservas podía devolver solo una parte del detalle.
- El resumen agregado podía seguir reflejando el total real, creando un XLSX internamente inconsistente.
- El modo local además cortaba explícitamente a 200 reservas mediante `list(200, true)`.

## Objetivo

- Exportar todas las reservas del rango permitido de hasta 366 días.
- Mantener el mismo tenant, rol, PII y rango de fechas autoritativos.
- Evitar `OFFSET`; usar cursor keyset estable.
- Mantener las filas finales del XLSX ordenadas por horario.
- No tocar pagos ni convertir el export en una fuente financiera.

## Producción

Nueva RPC de lectura `get_admin_export_reservations_page`:

- actor desde `phase6_admin_actor()`;
- solo OWNER/ADMIN;
- sin `business_id` ni `user_id` recibidos del navegador;
- mismo filtro por fecha local del tenant;
- páginas máximas de 500 filas;
- cursor compuesto `(created_at, id)` ascendente;
- la primera página fija un snapshot superior `(created_at, id)` y todas las siguientes respetan ese mismo límite, por lo que nuevas reservas creadas durante el export no alargan ni alteran el conjunto;
- `SECURITY DEFINER` con `search_path` fijo;
- EXECUTE revocado a PUBLIC/anon y concedido a authenticated, quedando el permiso real sujeto al actor interno.

La ruta del XLSX itera hasta recibir una página menor al tamaño de lote, acumula todas las filas y finalmente ordena por `(startAt, createdAt, id)` para conservar la presentación histórica del reporte.

## Modo local

Reutiliza `listPage` de B51 en sus cuatro vistas disjuntas:

- active;
- completed;
- cancelled;
- archived.

Cada vista se recorre hasta `nextCursor=null`; después se filtra por el rango local y se ordena igual que producción.

## Seguridad y consistencia

- No se modifica la autorización de exportes.
- No se expone otro tenant.
- No se añade acceso público a PII.
- No se usa OFFSET ni un límite global que descarte filas silenciosamente.
- No se cambia el significado de métricas ni valores monetarios.

## Validación

- TypeScript y lint.
- Test focal B53.
- Contrato SQL de actor/tenant/cursor/límite/privilegios.
- Repo completeness y `git diff --check`.
- Suite completa.
- Build de producción.

## Fuera de alcance

- No cambiar formato visual del XLSX.
- No introducir pagos o estados de cobro.
- No push, commit ni deploy.
