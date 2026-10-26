# BLOQUE 33 — Supervisión global completa por tenant

Trabaja sobre B20–B32 y el ajuste previo `PRE_B33_CAXAS_SCOPE` ya validados. No reabras bloques anteriores salvo regresión real.

## Objetivo

Completar la regla de administración de Caxas Sport Center:

- `/admin-global` pertenece únicamente al ADMIN global de la plataforma.
- OWNER/ADMIN/STAFF de cada negocio siguen confinados a su propio tenant.
- El ADMIN global puede seleccionar un negocio desde `/admin-global` y operar su panel `/admin/**` con alcance de un solo tenant a la vez.
- Volver a `/admin-global` debe abandonar el scope operativo anterior para evitar acciones accidentales sobre el último negocio seleccionado.

## Hueco corregido

El scope previo ya alimentaba `get_current_admin_context`, `phase6_admin_actor`, `can_view_business` y `can_manage_business`. Sin embargo, las políticas de `storage.objects` para `business-gallery` todavía resolvían permisos directamente desde `profiles`.

Consecuencia: el ADMIN global podía abrir Configuración y editar servicios/paleta del tenant seleccionado, pero una subida real de imagen podía ser rechazada por Storage al no existir un profile tenant artificial para la cuenta global.

B33 elimina esa inconsistencia.

## Implementación

1. Recrear `business_gallery_admin_insert`, `business_gallery_admin_update` y `business_gallery_admin_delete` usando `public.can_manage_business()`.
2. Derivar el `business_id` únicamente del primer segmento UUID del path `business-gallery/<business_id>/<file>`.
3. Validar formato UUID antes del cast para que paths malformados fallen como no autorizados y no como excepción de conversión.
4. Mantener `app/api/admin/site-media` derivando el path desde `getAdminContext().businessId`; el cliente nunca aporta `businessId`.
5. En login, priorizar `getPlatformAdminContext()` para que la cuenta global siempre aterrice en `/admin-global`, incluso si quedó una cookie de scope anterior.
6. En logout, eliminar la cookie `caxas-platform-business`.
7. Incluir `/admin-global/:path*` en Proxy y limpiar el scope al volver al panel principal.
8. Mantener `AdminAccessManagement` exclusivamente para `context.role === 'owner'`: el ADMIN global scoped actúa como `app_role='admin'`, no como OWNER, y no recibe por esta vía transferencia de propiedad ni gestión owner-only.

## Seguridad

- No crear perfiles `profiles` artificiales para el ADMIN global.
- No aceptar `business_id` desde uploads/formularios como prueba de autorización.
- Manipular cookie/header no concede permisos: `can_manage_business` solo honra el scope cuando `is_platform_admin()` y `platform_admin_selected_business_id()` son válidos.
- STAFF, CUSTOMER y anon no obtienen escritura de Storage.
- La administración global sigue siendo de una sola cuenta activa según el guard previo a B33.

## Validación obligatoria

1. `git diff --check`
2. `npm run typecheck`
3. `npm run lint`
4. Tests enfocados `platform-admin-supervision`, `platform-admin`, `platform-caxas-scope`, `platform-media`, `admin-auth-ui`.
5. `npm test`
6. `npm run validate:supabase-security`
7. `npm run qa`
8. `npm run validate:repo`
9. `npm run build`
10. `npm audit --audit-level=moderate`
11. SQL E2E `platform_admin_supervision.sql` cuando Docker/Supabase local esté disponible.

No hacer commit, push, migraciones remotas ni deploy sin autorización explícita.
