# CAXAS SportCenter · corrección del acceso global a un negocio

**Incidencia (10/11/2026).** Tras crear un negocio desde `/admin-global`, la acción «Administrar negocio» llevaba a `/admin/acceso-denegado` con el mensaje «La cuenta no tiene un perfil administrativo activo».

## Verificación del origen

- Se verificó en Supabase de solo lectura que el negocio más reciente existe, está activo, tiene un perfil OWNER activo y utiliza un UUID válido. No era necesario crear otro propietario ni cambiar roles.
- En la BD productiva, `get_current_admin_context()` mantiene la regla de ámbito: un ADMIN global solo obtiene contexto de un negocio cuando PostgREST recibe `x-platform-business-id` y `private.platform_admin_selected_business_id()` comprueba ese negocio. Sin elección explícita no recibe permisos tenant, deliberadamente.
- La acción anterior usaba un `next/link` hacia una ruta `GET` que modificaba la cookie y redirigía al panel. La navegación cliente/prefetch de Next puede interponerse entre `Set-Cookie` y el montaje del panel, dejando la petición de autorización sin selección.

## Corrección

1. «Administrar negocio» ahora utiliza un formulario **POST nativo** con `businessId` oculto; fuerza navegación completa, evita prefetch y no depende del estado del router.
2. La ruta `/api/admin-global/select-business` verifica origen/host y ADMIN global autenticado **antes de crear el cookie**. Valida el UUID y devuelve `303 See Other` a `/admin` con `caxas-platform-business`, `SameSite=Lax`, `Secure` en producción y `Cache-Control: no-store`.
3. `GET` no selecciona negocios ni instala cookies. Redirige a la administración global.
   Las redirecciones son relativas (`Location: /admin` y `Location: /admin-global`) para no saltar al host interno `localhost` que Next puede normalizar tras un reverse proxy y perder la cookie por cambio de origen.
4. En `/admin/acceso-denegado`, si la sesión sigue siendo ADMIN global, se muestra un diagnóstico específico de selección fallida y un enlace seguro para volver al panel global. Otros usuarios siguen viendo la denegación genérica.
5. Se mantuvieron **sin cambios** las reglas RPC, `is_platform_admin`, la RLS, el sistema de autenticación, el propietario del negocio, los perfiles y las reservas.

## Verificación

- Pruebas de regresión añadidas en `tests/platform-admin-business-selection-post.test.ts`.
- Se comprueba que un origen distinto es rechazado y que una llamada sin sesión válida no puede instalar `caxas-platform-business`.
- La validación de origen usa `Host` o `X-Forwarded-Host` además de `request.nextUrl.host`, ya que Next.js puede normalizar el hostname interno.
- Para confirmar el acceso *autenticado* de punta a punta, probar con una sesión global real después de la publicación. No se crean sesiones ni credenciales simuladas y no se cambian permisos para superar el error.
