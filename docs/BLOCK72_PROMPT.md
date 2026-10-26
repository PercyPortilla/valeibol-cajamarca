# BLOQUE 72 — Rediseño maestro · Bloque 8: modo noche + reflectores

Corresponde al **Bloque 8** del plan visual de Caxas SportCenter.

## Alcance

- `isNightSlot(selectedTime)` activa modo noche desde `18:00` inclusive.
- Oscurecer progresivamente el diorama y elevar contraste nocturno.
- Encender reflectores con lamp glow y haz ambiental suave.
- Iluminar discretamente ventanas del edificio y borde/superficie deportiva.
- Mostrar el indicador exacto `Con iluminación` cuando el horario seleccionado es nocturno.
- Antes de las 18:00 mantener reflectores secundarios y escena neutra.

## Restricciones

- Comportamiento exclusivamente visual.
- No tocar pricing, reglas de reserva ni inventar importes.
- No usar la hora actual del dispositivo.

## Validación

- Focales 17:59/18:00, reflectores, copy y ausencia de precios inventados.
- TypeScript, lint, suite y build antes de avanzar.
