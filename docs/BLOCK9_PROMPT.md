# Prompt operativo · Bloque 9 — Administrador global

Crear un panel de administración global separado del panel operativo `/admin` de cada negocio.

## Seguridad

- Únicamente `user_accounts.role = 'admin'` activo concede acceso global.
- `profiles.role = 'admin'` de un negocio NO concede acceso cross-tenant.
- No elevar roles globales automáticamente desde administradores heredados.
- Todas las RPC de lectura/mutación global verifican `is_platform_admin()` o el rol global equivalente.
- Revocar ejecución a anon; authenticated puede invocar RPC, pero la RPC debe rechazar cuentas no globales.
- No exponer PII de clientes en el resumen global inicial.
- No permitir borrado destructivo de negocios; solo activar/desactivar.

## Panel

Crear `/admin-global` protegido server-side. Mostrar métricas globales: negocios, sedes, canchas, usuarios, reservas y reportes de pago. Listar tenants con estado, ciudad, sedes, canchas y reservas. Permitir activar/desactivar negocio mediante RPC segura.

El panel debe indicar explícitamente que es cross-tenant y que el rol ADMIN global requiere asignación privilegiada explícita fuera del cliente. No añadirlo automáticamente a la navegación de administradores de negocio.

No hacer deploy, no instalar dependencias y no tocar Next.js. Validar TypeScript, lint, tests, seguridad, repo y build.
