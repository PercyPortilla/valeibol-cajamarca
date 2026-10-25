# Prompt operativo · Bloque 16 — Ubicación, mapa y descubrimiento geográfico

Trabaja sobre B14+B15 ya validados. Este bloque incorpora descubrimiento geográfico usando exclusivamente las direcciones y coordenadas de `venues` que ya viajan en el catálogo público.

## Objetivo

- Mostrar en `/buscar` un explorador de sedes con mapa real y selección de ubicación.
- Deduplicar por `venueId`, no por negocio: un complejo puede tener varias sedes.
- Usar coordenadas cuando existan; si no existen, usar la dirección pública ya configurada.
- Permitir abrir la sede seleccionada en Google Maps y entrar al complejo correspondiente.
- Añadir “Cómo llegar” en la ficha genérica de cada complejo.

## Arquitectura

- No crear tablas, migraciones ni RPC nuevas.
- Reutilizar `get_public_platform_catalog`, que ya expone `venue_address`, `latitude` y `longitude`.
- Crear una transformación en memoria `buildPlatformLocationPoints` para deduplicar sedes.
- Mantener el mapa en un único componente cliente; no convertir las cards ni el catálogo completo a Client Components.
- No hacer un iframe por card. Solo se muestra un mapa embebido para la sede seleccionada.

## UX y accesibilidad

- El mapa es suplementario: la lista textual de sedes sigue visible y operable sin interactuar con el iframe.
- Los selectores de sede y CTAs deben mantener targets mínimos de 44 px.
- Cada selector usa estado accesible (`aria-pressed`).
- El iframe tiene `title` específico, carga lazy y no debe ser la única forma de conocer la ubicación.
- En móvil, lista y mapa pasan a una sola columna sin overflow horizontal.
- La navegación “Abrir en Maps” y “Cómo llegar” abre una pestaña externa con `rel=noreferrer`.

## Seguridad y privacidad

- No solicitar geolocalización del usuario ni permisos de ubicación en este bloque.
- No inventar coordenadas ni geocodificarlas en backend.
- No exponer PII ni ampliar el RPC público.
- No introducir claves de Google Maps ni secretos de mapas.

## Validación obligatoria

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run validate:repo`
5. `npm run validate:supabase-security`
6. `npm run qa`
7. `npm run build`
8. `git diff --check`

## Entrega

Reportar componentes, utilidades, tests y revisión visual. No hacer commit, push, migraciones remotas ni deploy sin autorización explícita posterior.
