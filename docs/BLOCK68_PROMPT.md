# BLOQUE 68 — Rediseño maestro · Bloque 4: sistema visual por deporte

Corresponde al **Bloque 4** del plan visual de Caxas SportCenter.

## Alcance

- Centralizar configuración contextual en `sportThemeConfig`.
- Cada deporte define `visual`, `label`, `sceneLabel`, `icon`, `accent` y `accentSoft`.
- Cubrir fútbol, vóley, básquet, futsal y multi-deporte; conservar tenis como extensión compatible.
- El selector solo cambia el objeto `theme`; no navega, no sustituye el Hero ni monta componentes legacy.
- El visual recibe el tema completo para que los siguientes bloques puedan resolver su render desde una única fuente.

## Restricciones

- La base visual continúa negro/grafito/plata.
- No introducir backend ni condicionales dispersos por deporte.
- No implementar todavía el render premium definitivo.

## Validación

- Focales de configuración, fallback y ausencia de condicionales repetidos en `HomeHero`.
- TypeScript, lint, suite y build antes de avanzar.
