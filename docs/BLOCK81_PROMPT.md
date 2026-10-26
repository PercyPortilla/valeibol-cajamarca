# BLOCK81 · Landings deportivas premium

## Objetivo

Eliminar la apariencia azul/blanca legacy de `/futbol`, `/voley`, `/futsal` y `/basquet` y alinearlas con la identidad metal negro + plata de Caxas SportCenter.

## Alcance implementado

- `SportLandingPage` continúa siendo la plantilla única para las cuatro rutas.
- Header premium con logo oficial y navegación global.
- Hero negro/grafito/plata con acento contextual por deporte.
- Panorama multicancha B79 enfocado automáticamente en el deporte de la URL.
- Iluminación visual B80 basada en hora real de Cajamarca.
- Cobertura fija `Cajamarca, Perú`.
- Buscador existente preservado, reestilizado para el sistema premium.
- Resultados continúan usando datos reales y ahora renderizan `BusinessCard` premium.
- Empty state, footer, responsive, focus y reduced motion adaptados al nuevo tema.

## Preservado sin cambios

- URLs y metadata SEO.
- Reglas de indexación/canonical según inventario real.
- Catálogo, Supabase, reservas, autenticación y tenants.
- Sin precios, disponibilidad ni conteos inventados.

## Fuera de alcance

- Rediseño general de `/buscar`, Mi cuenta o administración.
- Cambios de backend o reglas comerciales.
- Commit, push o deploy; se realiza solo cuando el usuario autorice la publicación final.
