# BLOQUE 70 — Rediseño maestro · Bloque 6: transiciones entre deportes

Corresponde al **Bloque 6** del plan visual de Caxas SportCenter.

## Alcance

- Mantener el mismo `SportComplexVisual` montado al cambiar deporte.
- Transicionar superficie, equipamiento, micro desplazamiento y glow entre 280–420 ms.
- Cambiar arcos, red, aros, multi-complejo y acento mediante `data-scene`, sin navegar ni recuperar la UI antigua.
- Evitar `display:none` en el equipamiento contextual para permitir fade/scale suave.
- Mantener comportamiento estable ante cambios rápidos de selector.
- Desactivar transiciones con `prefers-reduced-motion`.

## Restricciones

- Sin timers de aplicación ni estados de transición paralelos.
- Sin remount por `key` y sin dependencias de animación externas.
- Sin cambios de backend o reservas.

## Validación

- Focales de estructura estable, duraciones, visibilidad y reduced motion.
- TypeScript, lint, suite y build antes de avanzar.
