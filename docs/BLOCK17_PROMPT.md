# Prompt operativo · Bloque 17 — SEO local y datos estructurados

Trabaja sobre B14–B16 validados. El objetivo es convertir el Sport Marketplace y sus fichas de complejos en superficies indexables coherentes, usando únicamente datos públicos reales que ya existen en el catálogo.

## Objetivo

- Consolidar una URL canónica pública del sitio desde configuración de entorno/Vercel.
- Mantener home, `/buscar` base, `/voley`, `/futbol` y fichas de complejos como superficies SEO claras.
- Evitar indexar combinaciones facetadas de `/buscar?deporte=...&ciudad=...`.
- Añadir datos estructurados seguros para marketplace y complejos deportivos.
- Añadir breadcrumbs visibles y accesibles en búsqueda y fichas genéricas.

## Canonicals e indexación

- Home: index/follow, canonical `/`.
- `/buscar` sin filtros: index/follow, canonical `/buscar` y puede permanecer en sitemap.
- `/buscar` con `deporte` o `ciudad`: `noindex,follow`; no canonicalizar engañosamente la variante hacia la página base.
- `/voley` y `/futbol`: indexables con canonical propio.
- Las landings deportivas sin inventario real deben ser `noindex,follow` y no aparecer en sitemap hasta contar con oferta.
- `/complejo/[slug]`: canonical self cuando el complejo existe; resultados inexistentes siguen usando `notFound()`.
- `/reservar`, `/mi-cuenta`, `/propietario`, `/admin/**` y `/admin-global` son superficies operativas/transaccionales y deben permanecer fuera del índice.
- No bloquear las facetas por `robots.txt`; el crawler debe poder leer la directiva `noindex`.

## Datos estructurados

- Home: `WebSite` y `ItemList` solo para los complejos realmente mostrados en portada.
- Complejo: `SportsActivityLocation` solo para sedes con dirección física real o coordenadas completas; `PostalAddress` solo con dirección real, `GeoCoordinates` únicamente cuando ambos valores son reales y finitos, imagen real cuando exista y relación con la organización del negocio.
- Breadcrumbs JSON-LD con Inicio → Buscar canchas → Complejo.
- `/buscar` base puede emitir BreadcrumbList; variantes noindex no necesitan datos de resultados.
- No inventar `aggregateRating`, `Review`, `reviewCount`, `ratingValue`, horarios, teléfono, estrellas, popularidad ni promociones.

## Seguridad

- El contenido del negocio es administrable: serializar JSON-LD con `JSON.stringify(...).replace(/</g, "\\u003c")` antes de insertarlo en `<script type="application/ld+json">`.
- No añadir dependencias SEO externas.
- No crear tablas, migraciones, RPCs ni una segunda fuente de datos.
- No hardcodear el dominio productivo; usar `NEXT_PUBLIC_SITE_URL` y, en Vercel, `VERCEL_PROJECT_PRODUCTION_URL`.

## UX

- Breadcrumbs visibles dentro del hero, con `nav aria-label="Migas de pan"`, lista ordenada y `aria-current="page"`.
- Mantener targets interactivos de al menos 44 px, focus-visible y responsive sin overflow.

## Validación obligatoria

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run validate:repo`
5. `npm run validate:supabase-security`
6. `npm run qa`
7. `npm run build`
8. `git diff --check`
9. Inspeccionar HTML generado para canonical, robots y `application/ld+json`.

## Entrega

Reportar metadata, sitemap/robots, JSON-LD, breadcrumbs, tests y cualquier limitación de entorno. No hacer commit, push, migraciones remotas ni deploy sin autorización explícita posterior.
