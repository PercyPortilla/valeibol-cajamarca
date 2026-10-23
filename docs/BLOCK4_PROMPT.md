# Prompt operativo · Bloque 4 — Página individual de complejo

Sobre el catálogo público creado en Bloque 3, implementar `/complejo/[slug]` sin duplicar datos ni crear otro backend.

La ruta debe resolver el negocio por slug y agrupar sus sedes y canchas. Mostrar nombre, ciudad/país, número de sedes/canchas, dirección de cada sede, deporte, superficie y precio mínimo disponible por cancha. Si el slug no existe, devolver 404 real.

Cada cancha debe enlazar al futuro flujo `/reservar` pasando únicamente identificadores/slug no sensibles. No implementar todavía la reserva completa dentro de este bloque.

Mantener la web Valeibol original en `/`, no alterar admin ni Supabase, no instalar dependencias y no hacer deploy.

Validar TypeScript, lint, tests y build antes de cerrar.
