# Ajuste previo a B33 · Caxas Sport Center, Cajamarca y jerarquía administrativa

Este ajuste se aplica después de B32 y antes de iniciar B33. Sustituye cualquier regla histórica que impedía al ADMIN global entrar al panel operativo de un tenant.

## Regla administrativa final

- **Administración principal de Caxas Sport Center (`/admin-global`)**: una sola cuenta ADMIN global activa.
- **Panel de cada negocio (`/admin/**`)**: sus OWNER/ADMIN/STAFF según permisos existentes, únicamente dentro de su propio tenant.
- **ADMIN global**: puede entrar al panel operativo de cualquier negocio seleccionándolo explícitamente desde `/admin-global`.
- El ADMIN global no se convierte en OWNER de los tenants y no obtiene perfiles artificiales en `profiles`.
- La selección se transporta con `x-platform-business-id`, pero PostgreSQL solo la honra cuando `is_platform_admin()` confirma una cuenta ADMIN global activa.
- El scope se limita a un solo tenant por vez. No habilita lectura simultánea indiscriminada de PII de todos los negocios.
- El ADMIN global puede supervisar también un tenant inactivo; los usuarios tenant normales continúan requiriendo negocio y perfil activos.
- Solo puede existir un `user_accounts.role='admin'` activo a la vez.

## Marca y alcance público

- Marca principal: **Caxas Sport Center**.
- Alcance territorial temporal: **Cajamarca, Perú**.
- El tenant histórico Valeibol conserva su nombre, contenido y landing propia; no se renombra a Caxas Sport Center.
- Home, búsqueda, SEO, JSON-LD, encabezado y pie de plataforma usan Caxas Sport Center.
- La búsqueda muestra Cajamarca como ciudad fija por ahora.
- `get_public_platform_catalog` solo devuelve inventario de Cajamarca, incluso si el cliente omite `p_city`.
- Una reserva `public_web` queda rechazada en base de datos si la cancha no pertenece a una sede/negocio de Cajamarca.

## Seguridad

- Manipular la cookie/header de scope no concede acceso a un owner, admin tenant, staff o customer.
- La ruta que selecciona negocio exige `requirePlatformAdminContext()` antes de escribir la cookie.
- El navegador sigue usando únicamente la clave pública/anon de Supabase; nunca se expone `service_role`.
- Acciones exclusivas de OWNER, como gestión de usuarios/transferencia de propietario principal, no se habilitan al ADMIN global porque su actor scoped se representa como `app_role='admin'`.

## Límites

- No se implementa todavía multi-negocio para un mismo propietario tenant.
- No se despliega ni se hace push automáticamente.
- B33 debe comenzar únicamente después de validar este ajuste.
