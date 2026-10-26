# BLOQUE 73 — Rediseño maestro · Bloque 9: resultados y tarjetas contextuales

Corresponde al **Bloque 9** del plan visual de Caxas SportCenter.

## Alcance

- Añadir una variante premium de `BusinessCard` con fondo grafito, borde plata, jerarquía clara y hover sobrio.
- Reutilizar exactamente `business.priceFrom`, moneda, sedes, canchas y reputación existentes.
- En `/buscar`, si existe una hora validada y `isNightSlot(time)` es verdadero, mostrar `Con iluminación`.
- La Home usa la variante premium, pero no muestra badge de iluminación porque su estado de hora no se comparte con la sección de tarjetas.

## Restricciones

- No hardcodear disponibilidad ni precios.
- No cambiar cálculo de tarifas.
- No afirmar que una cancha está disponible para fecha/hora cuando el catálogo no expone ese contrato.

## Validación

- Focales de variante premium, datos reales y badge contextual.
- TypeScript, lint, suite y build antes de avanzar.
