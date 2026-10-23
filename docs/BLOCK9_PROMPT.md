# Prompt operativo · Bloque 9 — Administrador global

Crear un panel de administración global separado del panel operativo `/admin` de cada negocio.

## Seguridad

- Únicamente `user_accounts.role = 'admin'` activo concede acceso global.
- `profiles.role = 'admin'` de un negocio NO concede acceso cross-tenant.
- No elevar roles globales automáticamente desde administradores heredados.
- Todas las RPC de lectura/mutación global verifican `is_platform_admin()` o el rol global equivalente.
- Revocar ejecución a anon; authenticated puede invocar RPC, pero la RPC debe rechazar cuentas no globales.
- No exponer PII de clientes en el resumen global inicial.
- El rol ADMIN global no debe reutilizar `can_view_business()` / `can_manage_business()` para leer directamente tablas tenant con PII. Las operaciones cross-tenant se exponen solo mediante RPCs globales sanitizadas y explícitas.
- `user_accounts` mantiene lectura directa únicamente de la propia cuenta; la comprobación ADMIN global se realiza dentro de funciones privilegiadas específicas.
- No permitir borrado destructivo de negocios; solo activar/desactivar.

## Panel

Crear `/admin-global` protegido server-side. Mostrar métricas globales: negocios, sedes, canchas, usuarios y reservas. Listar tenants con estado, ciudad, sedes, canchas y reservas. Permitir activar/desactivar negocio mediante RPC segura. No mostrar métricas ni reportes de pagos, porque la plataforma no procesa cobros.

- Paginar el listado de negocios; nunca presentar el tamaño de una página limitada como si fuera el total global.
- El total de usuarios cuenta cuentas de plataforma registradas; las métricas de sedes/canchas activas solo cuentan oferta perteneciente a negocios activos.
- No serializar al navegador identificadores internos de propietario ni PII de clientes que el listado no necesita.

El panel debe indicar explícitamente que es cross-tenant y que el rol ADMIN global requiere asignación privilegiada explícita fuera del cliente. No añadirlo automáticamente a la navegación de administradores de negocio.

No hacer deploy, no instalar dependencias y no tocar Next.js. Validar TypeScript, lint, tests, seguridad, repo y build.
