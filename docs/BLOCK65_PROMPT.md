# BLOQUE 65 — Rediseño maestro · Bloque 1: auditoría y corrección de base

Corresponde al **Bloque 1** del nuevo plan visual solicitado para Caxas SportCenter.

## Hallazgos

- La Home monta un único `HomeHero`; cambiar el `<select>` de deporte solo actualiza `sportSlug` y `SportComplexVisual`. No existe navegación, remount hacia `PlatformSearchForm` ni retorno deliberado al Hero anterior en ese evento.
- Persisten reglas históricas del Hero azul en `globals-5.css`. El Hero premium las sobreescribe por cascada, pero dependía de algunas propiedades estructurales antiguas (`display`, posicionamiento del grid/aside). Eso deja riesgo de regresión al seguir modificando la UI.
- El logo premium usa `object-fit: contain`, pero el wrapper tenía proporción `132x58`, distinta al asset `3:2`, además de `overflow: hidden`. La imagen completa cabía, pero el encuadre era innecesariamente restrictivo y podía percibirse cortado.
- `/buscar` y las landings deportivas siguen siendo superficies separadas con estilos históricos. Eso ocurre después de navegar, no por el cambio del selector dentro del Hero. Su alineación visual pertenece a bloques posteriores, no a esta corrección estructural.

## Corrección mínima

- Hacer explícitas dentro del Hero premium sus propiedades estructurales de layout para no depender del Hero legado.
- Asegurar `min-width: 0` en el aside para evitar overflow de grid.
- Dar al wrapper del logo la proporción real `3 / 2`, eliminar clipping y mantener `object-fit: contain` con altura automática.
- No cambiar backend, reservas, auth, tenants, rutas ni lógica de filtros.

## Validación

- Pruebas focales del Hero y logo.
- TypeScript y build obligatorios antes de cerrar el bloque.
