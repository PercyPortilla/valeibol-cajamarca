# Prompt operativo · Bloque 20 — Alta y gestión de inventario multi-tenant

Trabaja sobre B14–B19 validados. B20 cierra la brecha entre el marketplace multi-tenant ya operativo y la incorporación de inventario real: un ADMIN global puede dar de alta un negocio sin SQL manual y el OWNER/ADMIN del tenant puede gestionar sus sedes y canchas desde su propio contexto.

## Seguridad y ownership

- Mantener el DML directo de `businesses`, `venues`, `courts`, `profiles` y tablas operativas cerrado para el navegador.
- Toda mutación usa RPC `SECURITY DEFINER` con `search_path = public, pg_temp`.
- No volver a incluir ADMIN global dentro de `can_view_business`/`can_manage_business`; B9 lo separó deliberadamente de la PII tenant.
- `platform_admin_create_business` exige `is_platform_admin()` y crea el tenant junto con un OWNER cuya cuenta Auth ya exista.
- El owner se resuelve por correo dentro de PostgreSQL, nunca por `user_id` aportado por el cliente.
- El alta actual mantiene la restricción histórica de un `profiles.user_id` por negocio: rechazar una cuenta ya asignada a otro tenant.
- Una cuenta ADMIN global no puede degradarse a OWNER tenant durante el alta.
- `owner_user_id` es metadato de propiedad, no un bypass RLS: `can_view_business`/`can_manage_business` exigen negocio activo y perfil tenant activo.
- El owner principal no puede degradarse/desactivarse desde el panel tenant mientras B20 no implemente una transferencia global atómica.
- El ADMIN global no puede suspender un negocio con reservas futuras `pending` o `confirmed`; primero deben cerrarse/cancelarse para no dejar reservas vivas sin panel operativo.

## Alta global

- `/admin-global` incluye “Nuevo negocio”.
- Datos: nombre, slug, owner email, ciudad, país, dirección, teléfono público, moneda y timezone.
- No crear automáticamente una sede o cancha ficticia.
- El negocio puede quedar activo administrativamente; no aparecerá en catálogo mientras no exista sede/cancha activa real.
- Slug, moneda, timezone y owner principal quedan reservados al ciclo global en B20; el tenant no los edita.

## Estructura tenant

- `/admin/configuracion/estructura` es la superficie de negocio/sedes/canchas.
- OWNER y admin de negocio editan; staff tiene solo lectura.
- `get_admin_business_structure()` deriva el negocio desde `auth.uid()`/`profiles`; no acepta `p_business_id`.
- Perfil público editable: nombre, ciudad, país, dirección y teléfono.
- Sedes: crear/editar/activar-desactivar; coordenadas opcionales y nunca geocodificadas/inventadas.
- Una sede no puede desactivarse mientras tenga canchas activas.
- Canchas: deporte únicamente de los cuatro `sports` activos existentes; slug/deporte permanecen estables tras el alta.
- La cancha se crea inicialmente inactiva dentro de la transacción y solo se activa después de insertar horario semanal y dos tarifas reales aportadas por el propietario.
- Debe existir al menos un día abierto.
- Desactivar una cancha con reservas futuras `pending` o `confirmed` está prohibido.
- No hard delete de negocio/sede/cancha.

## Multi-tenant correctness

- El panel no debe renderizar `businessConfig` de Valeibol para tenants remotos.
- Fechas administrativas usan `context.timezone` real.
- La pantalla de precios muestra el timezone del tenant, no `America/Lima` hardcodeado.
- El modo local puede conservar la estructura demo como fallback explícitamente de solo lectura.

## UX

- `/propietario` permanece como hub y enlaza a “Negocio, sedes y canchas”.
- Formularios con labels reales, feedback visible, responsive y controles >=44px.
- El ADMIN global administra lifecycle/alta; no opera reservas, clientes ni PII tenant.
- No introducir pagos, métodos de cobro ni claims de automatización WhatsApp.

## Validación obligatoria

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run validate:repo`
5. `npm run validate:supabase-security`
6. `npm run qa`
7. `npm run build`
8. `npm audit --audit-level=moderate`
9. `git diff --check`

Ejecutar `supabase/tests/platform_inventory.sql` contra Postgres/Supabase local si el entorno existe. Si no existe, reportar esa limitación y no simular PASS. No hacer commit, push, migraciones remotas ni deploy sin autorización explícita.
