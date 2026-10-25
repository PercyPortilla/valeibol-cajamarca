# Prompt operativo · Bloque 19 — Expansión multi-deporte del marketplace

Trabaja sobre B14–B18 ya validados. Este bloque convierte los cuatro deportes normalizados y activos del modelo (`voley`, `futbol`, `futsal`, `basquet`) en categorías públicas de primera clase sin crear datos ficticios, tablas paralelas ni reglas de reserva duplicadas.

## Objetivo

- Mantener Vóley y Fútbol como landings deportivas.
- Añadir landings dedicadas para Futsal y Básquet.
- Reutilizar una sola plantilla y loader para todas las categorías.
- Mantener búsqueda, catálogo y booking sobre las mismas tablas/RPC multi-deporte existentes.
- Indexar y añadir al sitemap una landing deportiva únicamente cuando exista inventario real de ese deporte.
- Mostrar en portada el número real de canchas por deporte y un estado neutral cuando todavía no exista oferta activa.

## Fuente de verdad

- `config/sports.ts` define los cuatro deportes activos y sus reglas de booking.
- `get_public_platform_catalog` sigue siendo la fuente pública de inventario.
- `getPublicPlatformCatalog` + `groupCatalogByBusiness` siguen siendo el read-model de aplicación.
- No crear negocios, canchas, sedes, precios, ratings ni disponibilidad ficticios para poblar categorías vacías.

## Arquitectura

- Centralizar configuración de landings en `lib/platform/sportLanding.ts`.
- Reutilizar `components/platform/SportLandingPage.tsx` para `/voley`, `/futbol`, `/futsal` y `/basquet`.
- Compartir la carga por deporte con `React.cache` para evitar repetir el mismo RPC dentro de una renderización server-side cuando metadata y página necesitan el mismo inventario.
- La búsqueda facetada `/buscar?deporte=...` permanece funcional y `noindex`; las landings son las superficies SEO canónicas cuando tienen inventario.

## SEO

- Con inventario: `index,follow`, canonical propio y Open Graph.
- Sin inventario: `noindex,follow`, sin canonical ni Open Graph que simule oferta disponible.
- Sitemap: incluir cada landing deportiva solo si el catálogo contiene al menos una cancha de ese `sportSlug`.
- No inventar `ItemList`, ratings o disponibilidad para categorías vacías.

## UX

- La portada enlaza las cuatro categorías a su landing dedicada.
- El texto de cada tarjeta deportiva usa conteo real de canchas derivado del catálogo.
- Con cero canchas debe decir `Sin oferta activa todavía`, no `Ver opciones disponibles`.
- Mantener responsive, focus-visible, targets táctiles y `prefers-reduced-motion` existentes.

## Límites

- No crear migración SQL: B2 ya normalizó y sembró Vóley, Fútbol, Futsal y Básquet.
- No modificar reglas de `netHeightCm`: solo Vóley requiere altura de red.
- No crear inventario de demostración para Fútbol, Futsal o Básquet.
- No hacer commit, push, migraciones remotas ni deploy sin autorización explícita posterior.

## Validación obligatoria

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run validate:repo`
5. `npm run validate:supabase-security`
6. `npm run qa`
7. `npm run build`
8. `npm audit --audit-level=moderate`
9. `git diff --check`

Corregir cualquier regresión causada por B19 antes de continuar al siguiente bloque.
