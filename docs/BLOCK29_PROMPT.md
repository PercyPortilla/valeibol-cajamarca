# BLOQUE 29 — Contenido público completo por tenant

## Objetivo

Cerrar la brecha entre el editor de contenido del negocio y la ficha pública multi-tenant. Antes de B29, Owner/Admin podía guardar servicios, galería y paleta para su tenant, y PostgreSQL ya exponía ese contenido por `business_slug`, pero `/complejo/[slug]` solo lo consumía para la landing especial de Valeibol.

## Alcance

- `getPublicSiteContent(businessSlug)` carga el contenido del tenant solicitado mediante `get_public_site_content(p_business_slug)`.
- Se mantiene compatibilidad con la landing histórica de Valeibol usando su contenido por defecto únicamente como fallback de ese tenant.
- Un tenant genérico sin contenido configurado no hereda servicios ni galería de Valeibol.
- `/complejo/[slug]` genérico muestra únicamente servicios visibles del mismo tenant.
- La ficha muestra únicamente elementos visibles de galería con URL válida.
- La paleta configurada se aplica a la ficha pública mediante los tokens existentes de `themeCssVariables` y el mapeo de variables visuales del marketplace.
- Guardar contenido desde Configuración invalida también `/buscar` y las fichas `/complejo/[slug]`.
- La landing especial de Valeibol, reservas, tarifas, reseñas y catálogo público conservan su comportamiento actual.

## Seguridad y aislamiento multi-tenant

- B29 no agrega DML público ni una nueva RPC.
- Reutiliza `get_public_site_content(text)`, que ya exige negocio activo y publicado y devuelve solo servicios/galería visibles más la paleta sanitizada.
- El slug proviene de la ficha pública ya resuelta por el catálogo; no se acepta `business_id` autoritativo desde el navegador.
- No se mezclan defaults de Valeibol con otros tenants cuando falta Supabase, el RPC falla o el tenant no tiene contenido.

## UX

- Los servicios aparecen como tarjetas dentro de la ficha del complejo.
- La galería usa imágenes ya sanitizadas por la capa de contenido.
- Se ocultan secciones vacías en lugar de inventar contenido.
- La identidad visual del tenant adapta los tokens principales del marketplace sin romper contraste ni navegación global.
- En móvil, servicios y galería pasan a una sola columna.

## Archivos principales

- `lib/data/publicSiteContentService.ts`
- `app/complejo/[slug]/page.tsx`
- `app/admin/(protected)/actions.ts`
- `app/styles/globals-5.css`
- `tests/platform-tenant-content.test.ts`

## Límites

- No se rediseña la landing histórica de Valeibol.
- No se agregan pagos, cancelaciones de cliente ni cambios a reservas.
- No se modifica el esquema SQL porque el RPC público multi-tenant ya existe desde B24.
- No hay push, deploy ni migraciones remotas en este bloque.

## Validación

1. `node --test --experimental-strip-types tests/platform-tenant-content.test.ts tests/site-content.test.ts tests/platform-complex.test.ts tests/platform-media.test.ts`
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`
5. `npm run validate:repo`
6. `npm run validate:supabase-security`
7. `npm run qa`
8. `npm run build`
9. `npm audit --audit-level=moderate`
10. `git diff --check`
