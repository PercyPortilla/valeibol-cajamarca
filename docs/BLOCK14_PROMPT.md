# Prompt operativo · Bloque 14 — Evolución visual y comercial del Sport Marketplace

Trabaja sobre el release validado de los Bloques 1–13. Este bloque eleva la experiencia pública del marketplace sin crear un sistema paralelo, sin cambiar el modelo de datos y sin desplegar automáticamente.

## Objetivo

Transformar la superficie pública global en un marketplace deportivo más premium, claro y comercial, manteniendo intactas las reglas multi-negocio, multi-sede, multi-cancha y multi-deporte ya publicadas.

## Alcance

- Mejorar la portada global `/` con una jerarquía visual más fuerte, búsqueda protagonista, accesos rápidos y métricas derivadas del catálogo real.
- Mejorar las tarjetas de complejos con identidad visual, deportes, ubicación, número de sedes/canchas, precio base y CTA claro.
- Mejorar `/buscar` con hero comercial, resumen de resultados y filtros activos visibles.
- Mejorar la ficha genérica `/complejo/[slug]` con deportes, precio mínimo y una presentación más clara de sedes/canchas.
- Refinar header, footer, responsive, estados hover/focus y microinteracciones.
- Respetar `prefers-reduced-motion` y los targets táctiles mínimos ya establecidos.

## Fuente de verdad

- Usar `getPublicPlatformCatalog`, `groupCatalogByBusiness` y `buildBusinessDetail` existentes.
- No inventar ratings, reseñas, favoritos, disponibilidad instantánea, descuentos, promociones ni datos de negocios que no existan en el catálogo.
- Las métricas visibles deben derivarse del catálogo real o de la configuración local de deportes activos.
- Valeibol Cajamarca continúa como primer tenant completo en `/complejo/valeibol-cajamarca`.

## Restricciones

- No crear tablas, migraciones ni RPC nuevas para este bloque.
- No modificar RLS, roles CUSTOMER/OWNER/ADMIN ni auth.
- No alterar el flujo de reserva multi-deporte ni volver obligatorio `netHeightCm` fuera de vóley.
- No exponer pagos manuales en la narrativa pública.
- No afirmar que WhatsApp automático está activo.
- No reactivar marketing opt-in.
- No agregar dependencias de UI si el resultado puede resolverse con React/CSS existentes.
- No crear un nuevo proyecto Supabase, GitHub o Vercel.
- No hacer deploy, push o release salvo autorización explícita posterior.

## Diseño

- Mantener la marca global `Canchas` hasta que el usuario defina un nombre comercial definitivo.
- Priorizar contraste, legibilidad, profundidad, espacios amplios y una estética de marketplace deportivo moderno.
- Usar gráficos CSS y los iconos SVG ya existentes para evitar assets falsos o stock genérico.
- Mantener navegación usable en móvil sin overflow horizontal de la página.
- Conservar skip links, `focus-visible`, targets de 44px y `prefers-reduced-motion`.

## Validación obligatoria

Ejecutar y corregir cualquier regresión causada por B14:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run validate:repo`
5. `npm run validate:supabase-security`
6. `npm run qa`
7. `npm run build`
8. `git diff --check`

## Entrega

Reportar archivos modificados, mejoras visibles, validaciones ejecutadas y riesgos residuales. No declarar QA visual automatizada si Puppeteer/Axe no se ejecutó realmente.
