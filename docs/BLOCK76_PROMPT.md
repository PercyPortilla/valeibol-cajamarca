# BLOQUE 76 — Rediseño maestro · Bloque 12: validación funcional

Corresponde al **Bloque 12** del plan visual de Caxas SportCenter.

## Validaciones ejecutadas

- `npm run qa`: PASS.
  - Auditoría de seguridad Supabase: 73 migraciones revisadas, PASS.
  - Fase 7: 17/17 PASS.
  - Production hardening: 13/13 PASS.
  - Fase 8: 23/23 PASS.
  - Suite Node: 542/542 PASS al iniciar este bloque.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run validate:repo`: PASS.
- `git diff --check`: PASS.

## Smoke HTTP local

Responden correctamente:

- `/`
- `/buscar?deporte=voley&fecha=2026-10-26&hora=18:00`
- `/voley`
- `/futbol`
- `/futsal`
- `/basquet`
- `/complejo/valeibol-cajamarca`
- `/mi-cuenta`
- `/reservar`
- `/propietario`

Sin sesión, `/admin` y `/admin-global` redirigen al login protegido como corresponde.

La búsqueda conserva Vóley, fecha `2026-10-26`, hora `18:00` y el indicador `Con iluminación`.

## Nota de entorno

El script opcional `validate-preview-ui.mjs` requiere `puppeteer-core` y `axe-core`, que no están instalados en este workspace. La QA visual equivalente de Home se ejecutó directamente con Chrome DevTools en B75, incluyendo desktop/tablet/móvil, overflow, tamaños táctiles y reduced motion.

## Restricciones respetadas

- Sin Docker.
- Sin cambios de backend, auth, tenants, reservas, rutas ni reglas comerciales por el rediseño.
- Sin refactors ajenos.
