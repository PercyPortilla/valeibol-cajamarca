# BLOQUE 75 — Rediseño maestro · Bloque 11: responsive y pulido final

Corresponde al **Bloque 11** del plan visual de Caxas SportCenter.

## QA real ejecutada en Chrome

- Desktop `1440x1000`, Fútbol `17:00`: `overflowX=0`, logo completo `120x80`, diorama `514x430`, controles visibles mínimos `44px`.
- Tablet `900x1100`, Vóley `18:00`: `overflowX=0`, modo noche activo, `Con iluminación`, diorama `853x390`, controles mínimos `44px`.
- Móvil `390x1000`, Básquet `20:00`: `overflowX=0`, logo completo `96x64`, buscador antes del diorama, diorama `366x330`, stats debajo, controles mínimos `44px`.
- `prefers-reduced-motion: reduce` deja las transiciones calculadas prácticamente en cero.

## Alcance

- Mantener Hero a dos columnas en desktop y una columna desde tablet estrecha.
- Móvil: texto → buscador → indicador → diorama → estadísticas.
- Mantener logo y diorama sin recortes/deformaciones.
- Extender `validate-preview-ui.mjs` para verificar el diorama y los controles del buscador.
- No se detectaron cortes u overflow que requieran cambios adicionales de layout en esta pasada.

## Restricciones

- Sin backend ni refactors ajenos.
- Sin guardar screenshots temporales en el repositorio.
