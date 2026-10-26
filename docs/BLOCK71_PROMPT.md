# BLOQUE 71 — Rediseño maestro · Bloque 7: selector de fecha y hora

Corresponde al **Bloque 7** del plan visual de Caxas SportCenter.

## Alcance

- Mantener en el Hero deporte, fecha, hora y CTA `Explorar espacios`.
- Reutilizar `isNightSlot(selectedTime)` y derivar noche exclusivamente de la hora elegida.
- Validar `fecha` y `hora` al llegar a `/buscar`.
- Preservar ambos valores en el formulario de búsqueda y mostrarlos como contexto activo.
- No usar la hora real del dispositivo.

## Restricciones

- No convertir fecha/hora en filtros de disponibilidad si el catálogo actual no ofrece ese contrato.
- No alterar pricing ni reglas reales de reserva.
- Sin backend nuevo.

## Validación

- Focales de normalización, propagación de query y `isNightSlot`.
- TypeScript, lint, suite y build antes de avanzar.
