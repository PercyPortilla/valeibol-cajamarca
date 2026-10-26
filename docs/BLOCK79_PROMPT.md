# BLOCK79 · Complejo panorámico multicancha y cámara deportiva

## Objetivo

Reemplazar la representación de una sola cancha intercambiable por una escena única del complejo deportivo donde fútbol, vóley, básquet y futsal conviven en posiciones físicas distintas. Al seleccionar un deporte, la vista debe desplazarse y acercarse a su losa sin cambiar de página ni remontar el Hero.

## Alcance implementado

- `SportComplexVisual` conserva una sola instancia persistente.
- La escena incluye simultáneamente cuatro áreas: fútbol, vóley, básquet y futsal.
- Se añadieron fondo de montañas/ciudad, vías internas, edificios, graderías y torres de iluminación para reforzar la lectura de complejo deportivo.
- Cada deporte conserva equipamiento lógico: arcos, red o canastas según corresponde.
- `data-camera-focus` usa el tema deportivo activo para controlar paneo, zoom y ligera variación de ángulo.
- Las canchas no seleccionadas pierden intensidad y la cancha activa recibe mayor brillo, saturación y borde contextual.
- Multi-deporte mantiene la vista general del complejo.
- Tablet y móvil reciben escalas/encuadres específicos.
- `prefers-reduced-motion` elimina prácticamente la transición de cámara.

## Fuera de alcance

- Encendido de luces por hora real de Cajamarca: B80.
- Rediseño de `/voley`, `/futbol`, `/futsal` y `/basquet`: B81.
- Cambios de backend, disponibilidad, precios, reservas o Supabase.
