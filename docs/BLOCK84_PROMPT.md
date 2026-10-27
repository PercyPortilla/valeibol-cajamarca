# B84 · Hero full-bleed premium

## Objetivo

Transformar el Hero de Caxas SportCenter en una composición continua donde el complejo deportivo B83 forme parte del fondo, con copy y controles a la izquierda y el render dominante hacia el centro y la derecha.

## Composición

- El panorama deja de presentarse como una tarjeta aislada: no tiene borde, radio ni sombra propios dentro de la Home.
- Gradientes negros, máscara radial y profundidad conectan copy, buscador y render.
- La franja inferior integra accesos rápidos a deportes y estadísticas reales del catálogo.
- El render mantiene la cámara persistente, pan/zoom, fallback CSS, assets opcionales día/noche y la iluminación por hora real de Cajamarca.

## Responsive

- Desktop: copy/UI a la izquierda, complejo full-bleed dominante al centro/derecha y franja inferior integrada.
- Tablet y móvil: copy, buscador, render, deportes y estadísticas, en ese orden.
- Los accesos deportivos conservan targets de al menos 44 px, foco visible y reduced motion.
- No existe overflow horizontal.

## Fuera de alcance

No modifica backend, Supabase, reservas, autenticación, precios, tenants ni administración. No usa Three.js ni provoca navegación o remount al cambiar de deporte.
