# Prompt operativo · Bloque 15 — Catálogo visual multi-tenant con fotos reales

Trabaja sobre el estado validado del Bloque 14. El objetivo es conectar la galería pública administrable de cada negocio con las superficies globales del Sport Marketplace, sin crear una segunda galería, sin consultas N+1 y sin inventar imágenes.

## Objetivo

Hacer que las tarjetas, el destacado de portada y el hero genérico de un complejo puedan mostrar una foto real configurada por el propietario. Si el negocio no tiene fotografía pública visible, conservar el fallback gráfico deportivo existente.

## Fuente de verdad

- Reutilizar `public.business_site_content.gallery`.
- La portada es la primera imagen visible ordenada por `sortOrder`.
- No copiar la galería a `businesses`, `venues` o `courts`.
- No consultar `get_public_site_content` una vez por card; la portada debe viajar dentro de `get_public_platform_catalog`.
- Exponer solo `cover_image_url` y `cover_alt_text`, nunca la galería completa, servicios, tema ni datos privados desde el RPC del catálogo.

## Seguridad

- Mantener `get_public_platform_catalog` como `SECURITY DEFINER` con `search_path = public, pg_temp`.
- Revocar acceso genérico y conceder únicamente `EXECUTE` a `anon, authenticated`.
- El cliente/repository debe volver a validar la URL antes de incorporarla a estilos CSS.
- Admitir únicamente rutas locales aprobadas o URLs del bucket público `business-gallery` perteneciente al mismo origen Supabase configurado, sin credenciales embebidas.
- No exponer PII, notas internas, propietarios, usuarios, pagos ni teléfonos.

## UI

- `BusinessCard` usa portada real cuando existe y conserva el gráfico de cancha como fallback.
- La portada global puede usar la imagen del primer complejo destacado.
- `/complejo/[slug]` genérico puede usar la portada como fondo del hero con overlay suficiente para mantener contraste.
- Mantener `altText` accesible para fotografía real.
- No agregar stock photos ni assets ficticios.
- No eliminar `prefers-reduced-motion`, `focus-visible` ni targets mínimos de 44 px.

## Compatibilidad

- Valeibol Cajamarca sigue usando su landing dedicada y sus fotografías reales existentes.
- Los negocios sin `business_site_content` o sin foto visible continúan funcionando sin error.
- El catálogo local/mock conserva una portada real de Valeibol para desarrollo.
- No modificar reservas, auth, roles, precios, pagos, WhatsApp ni RLS ajeno al RPC público del catálogo.

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

Reportar migración, tipos/repositorios, superficies visuales actualizadas, tests y riesgos residuales. No hacer commit, push, migraciones remotas ni deploy sin autorización explícita posterior.
