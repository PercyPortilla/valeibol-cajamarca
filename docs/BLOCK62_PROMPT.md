# BLOQUE 62 — Propagación del logo tenant a ficha pública y SEO

Continúa sobre B1–B61 cerrados. B61 añadió `logo_url` por negocio, pero la identidad visual se perdía al abrir la ficha del complejo.

## Objetivo

- Conservar `logoUrl` al construir `PlatformBusinessDetail`.
- Mostrar el logo configurado en la ficha pública genérica del complejo.
- Hacer que la landing histórica de Valeibol use el logo del catálogo en header y footer, manteniendo fallback al logo legado si aún no existe `logo_url` remoto.
- Publicar el logo del negocio en JSON-LD.
- Usar el logo como imagen social de respaldo cuando el negocio no tenga portada.

## Seguridad y alcance

- No crear nueva tabla, RPC ni migración.
- Reutilizar únicamente `logoUrl` ya sanitizado por el catálogo público de B61.
- No ampliar permisos ni aceptar `business_id` del navegador.
- Mantener el aislamiento tenant y la compatibilidad con la landing heredada de Valeibol.

## UX

- Logo visible junto al nombre del complejo cuando exista.
- Sin logo: la ficha sigue funcionando sin reservar espacio vacío.
- Valeibol conserva su logo estático como fallback mientras B61 no esté aplicado remotamente.

## Validación

- Tests focales para propagación de `logoUrl`, ficha pública, landing Valeibol y JSON-LD.
- TypeScript, lint, validate:repo, validadores de seguridad, suite completa y build.

No hacer commit, push, deploy ni aplicar migraciones remotas sin autorización explícita.
