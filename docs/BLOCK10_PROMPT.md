# Prompt operativo · Bloque 10 — Migración de Valeibol al primer tenant

Convertir formalmente la web actual de Valeibol en el primer complejo de la plataforma sin perder su experiencia existente.

## Regla principal

No rehacer ni resumir la landing de Valeibol. Extraerla a un componente server reutilizable y conservar sus secciones, estilos, disponibilidad, tarifas, servicios, galería, ubicación, contacto y flujo de reserva.

Montar esa experiencia completa en `/complejo/valeibol-cajamarca`. El resto de complejos sigue usando la página genérica de `/complejo/[slug]`.

Reemplazar `/` por la portada global del marketplace: buscador por deporte/ciudad, categorías deportivas, complejos disponibles y acceso para propietarios. No presentar la raíz como si toda la plataforma fuera Valeibol.

Actualizar metadata global y sitemap para reflejar el marketplace, manteniendo metadata específica para Valeibol.

No borrar componentes heredados, no cambiar reservas, auth, DB o pagos. No hacer deploy. Validar TypeScript, lint, tests y build.
