# B83 · Render deportivo definitivo

## Objetivo

Preparar el Hero de Caxas SportCenter para usar un par de renders arquitectónicos premium del mismo complejo, uno diurno y otro nocturno, sin degradar la experiencia mientras esos assets aún no estén disponibles.

## Contrato visual

- Los assets esperados son `public/images/caxas-complex-day.webp` y `public/images/caxas-complex-night.webp`.
- Ambos deben producirse desde exactamente la misma cámara, encuadre y relación de aspecto.
- La capa de renders comparte un único contenedor de cámara; día y noche solo cambian por opacidad.
- Si los WebP no existen o no cargan, el fondo queda transparente y permanece visible el panorama CSS actual como fallback temporal.
- El fallback conserva fútbol, vóley, básquet, futsal, graderías, cercos, edificios, reflectores y contexto de montañas/Cajamarca.

## Interacción preservada

- Enfoques: `multi`, `football`, `volleyball`, `basketball` y `futsal`.
- Pan y zoom: 720 ms, sin navegación y sin remount.
- `prefers-reduced-motion: reduce`: transición de cámara prácticamente instantánea.
- La escena día/noche continúa dependiendo exclusivamente de la hora real de `America/Lima` mediante B80; la hora elegida en el formulario solo informa la necesidad comercial de iluminación.

## Fuera de alcance

No modifica backend, Supabase, reservas, precios, autenticación, tenants ni administración. B82 y los bloques anteriores permanecen intactos.
