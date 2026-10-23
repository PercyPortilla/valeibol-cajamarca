# Prompt operativo · Bloque 6 — Panel del propietario

Reutilizar el panel administrativo ya existente como motor operativo del propietario; no crear un dashboard paralelo.

Crear `/propietario` como entrada protegida que use el mismo `AdminContext`. Solo `owner` y `admin` de negocio acceden a esta portada; `staff` continúa directamente en `/admin` con sus permisos limitados.

La portada debe enlazar a las funciones existentes: agenda/disponibilidad, reservas, clientes, precios, reportes y configuración. Añadir desde el shell administrativo un retorno al portal propietario solo para roles autorizados.

No duplicar repositorios, acciones, RLS ni componentes administrativos. Mantener `/admin` funcionando como fuente operativa única. No afirmar soporte de selección multi-negocio hasta que las RPC administrativas dejen de depender del perfil único heredado.

No hacer deploy, no tocar pagos ni Next.js. Validar TypeScript, lint, tests y build.
