# Prompt operativo · Bloque 3 — Portal público global

Trabaja sobre la arquitectura multi-tenant ya preparada en Bloques 1 y 2.

Objetivo: crear el portal público de descubrimiento sin reemplazar todavía la home histórica de Valeibol.

Implementar un repositorio/read-model reutilizable para consultar el catálogo público sanitizado de Supabase con fallback local de desarrollo. Debe soportar filtros por deporte y ciudad, agrupar múltiples sedes/canchas bajo un mismo negocio y no exponer PII.

Crear las rutas `/buscar`, `/voley` y `/futbol`, reutilizando componentes y estilos existentes cuando sea razonable. La búsqueda debe usar parámetros GET, ser usable sin JavaScript y mostrar estados vacíos reales en vez de inventar resultados.

Mantener `/` intacto en este bloque para no retirar la web actual antes de migrarla formalmente al primer tenant. Los resultados pueden enlazar a `/complejo/[slug]`, que se desarrollará en el bloque siguiente.

No instalar dependencias, no modificar pagos, auth, reservas autoritativas ni admin. No hacer deploy.

Validar TypeScript, lint, tests y build; corregir cualquier fallo antes de cerrar.
