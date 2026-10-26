# BLOQUE 69 — Rediseño maestro · Bloque 5: render deportivo premium

Corresponde al **Bloque 5** del plan visual de Caxas SportCenter.

## Alcance

- Sustituir el visual de canchas planas por un diorama CSS 3D ligero.
- Mantener un único componente y resolver la escena con `data-scene={theme.visual}`.
- Fútbol: superficie verde, arcos, cerramiento, edificio y reflectores.
- Vóley: superficie azul, red y postes visuales, cerramiento y reflectores.
- Básquet: superficie naranja, aros/tableros y áreas de llave.
- Futsal: superficie cian, arcos y cerramiento.
- Multi-deporte: mini complejo con fútbol, vóley, básquet y volumen cubierto.
- Mantener proporción estable y reglas responsive propias en tablet/móvil.
- No introducir Three.js, WebGL ni dependencias pesadas.

## Restricciones

- Sin cambios de backend, datos o reservas.
- Las transiciones entre escenas se afinan en el Bloque 6.
- El modo noche/reflectores definitivo se afina en el Bloque 8.

## Validación

- Focales de escenas/equipamiento/responsive.
- TypeScript, lint, suite y build antes de avanzar.
