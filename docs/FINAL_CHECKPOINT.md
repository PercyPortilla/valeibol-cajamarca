# Valeibol Cajamarca · Checkpoint final de validación

Fecha: 2026-10-14

Estado global: **NO PASS FINAL — NO MERGE / NO PRODUCTION PROMOTION**

Este checkpoint resume únicamente evidencia realmente ejecutada. Los bloqueos externos detallados y pasos de reanudación están en `docs/FINALIZATION_BLOCKERS.md`.

## SHA

El SHA autoritativo del checkpoint es el HEAD de `work/final-checkpoint` que contiene este documento. Consultar el PR #4 para el SHA actualizado después de este commit.

Base no modificada:

- `main`: `22b4270b3b46d46802fe12bb45ba9b7b325b0799`

PR:

- #4 · `work/final-checkpoint -> main`
- estado: draft
- merge: NO ejecutado

## Bloque 1 — Repositorio reproducible

**PASS**

Evidencia:

- migraciones 001..007 versionadas;
- seed/tests/scripts presentes;
- `package-lock.json` presente;
- CI usa `npm ci`;
- repository completeness falla si faltan artefactos;
- checkout limpio en GitHub Actions pasa install/lint/typecheck/tests/QA/build.

## Bloque 2 — Supabase real, RLS y RPC

**BLOCKED EXTERNO / NO PASS FINAL**

PASS en repositorio:

- baseline transversal de `SECURITY DEFINER`;
- `search_path = public, pg_temp`;
- aislamiento PII;
- roles owner/admin/staff;
- DML administrativo por RPC;
- escritura pública autoritativa server-side/service role;
- grants explícitos sobre `availability_revisions`.

Bloqueo real:

- Supabase MCP devuelve `{"projects":[]}`;
- no existe `project_id` verificable en esta sesión.

No ejecutado por ese bloqueo:

- comparación/aplicación remota de migraciones;
- suite SQL contra PostgreSQL real;
- Security Advisors;
- Performance Advisors;
- generación de tipos desde esquema remoto.

## Bloque 3 — E2E y concurrencia real

**BLOCKED EXTERNO / NO PASS FINAL**

PASS en repositorio:

- scripts de integración existentes;
- matriz añadida para:
  - pública vs manual;
  - edición hacia intervalo ocupado;
  - confirmar/cancelar simultáneo;
  - pricing concurrente;
- scripts fallan explícitamente si faltan credenciales.

No ejecutado contra backend real porque Supabase no está accesible.

## Bloque 4 — UX, responsive y accesibilidad

**PASS DEL CHECKPOINT / PARCIAL PARA ADMIN AUTENTICADO**

Chrome real + Axe sobre el SHA actual:

- 360: PASS
- 390: PASS
- 430: PASS
- 768: PASS
- 1024: PASS
- 1440: PASS

Matriz:

- 54 checks;
- 0 failures;
- sin overflow horizontal;
- targets táctiles >=44 px;
- Axe serious/critical = 0;
- navegación/login admin protegidos;
- capturas artifact `11891053641`.

Se encontró y corrigió un fallo real: targets del header <44 px en 1024/1440.

Pendiente externo:

- pizarra/clientes/precios autenticados con datos reales, bloqueados por ausencia de Supabase/Auth real.

## Bloque 5 — Web comercial

**PASS DE CÓDIGO / PENDIENTES DE CONTENIDO EXTERNO**

Incluye:

- copy comercial sin términos técnicos;
- seis espacios de galería;
- favicon simple;
- privacidad;
- CTA y SEO;
- horario 08:00–23:00 tratado como provisional;
- no se inventaron fotografías.

Pendiente externo:

- fotos reales del negocio;
- confirmación oficial de horario.

## Bloque 6 — Hardening, CI y producción

**PARTIAL / FAIL CRÍTICO EXTERNO**

PASS:

- `npm ci`;
- lint;
- typecheck;
- tests;
- QA;
- build;
- no fallback mock en producción del checkpoint;
- smoke público automatizado;
- proyecto archive congelado para nuevos builds mediante `commandForIgnoringBuildStep = "exit 0"`, sin eliminarlo.

Producción canónica:

- proyecto: `valeibol-cajamarca`;
- project id: `prj_XAMLMdxEH8zqrwfSwdL8XSGQ9D5m`;
- alias: `valeibol-cajamarca-live.vercel.app`;
- producción actual sigue en `main` SHA `22b4270...`.

Producción actual observada:

- `/`: 200 PASS;
- `/admin`: 307 a login PASS;
- `/robots.txt`: 200 PASS;
- `/sitemap.xml`: 200 PASS;
- `/privacidad`: 404 FAIL;
- UI producción: fallback referencial visible;
- targets header <44 px en 1024/1440;
- artifact producción `11891228440`.

Vercel:

- envs canónicos: 0;
- hidden production envs: 0;
- project connectors: 0;
- runtime observability: 403 por permisos;
- nuevo preview final: 402 `api-deployments-free-per-day`, >100 deployments, retryAfter 86400.

GitHub:

- `main.protected = false`;
- required checks: ninguno;
- rulesets: `[]`;
- el conector no expone escritura administrativa de branch protection.

## Bloque 7 — WhatsApp Business Platform

**PASS DE CÓDIGO / BLOCKED PARA META REAL**

PASS:

- Cloud API oficial;
- outbox privado;
- idempotencia;
- `FOR UPDATE SKIP LOCKED`;
- retry/backoff;
- recovery de `processing`;
- auth segura del procesador;
- E.164;
- tests provider failure/timeout/200 sin message id;
- CI completo.

No ejecutado contra Meta real porque:

- Vercel tiene 0 envs;
- no hay credenciales/templates autorizados disponibles;
- no se expusieron secretos;
- no se enviaron mensajes reales;
- no se afectaron reservas.

## Validación final del código

La suite obligatoria del checkpoint debe mantenerse en PASS en el último HEAD:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run qa`
- `npm run build`

Además:

- responsive/Axe actual: PASS 54/54;
- SQL/E2E real: BLOCKED;
- Advisors reales: BLOCKED;
- smoke backend producción: BLOCKED;
- Meta real: BLOCKED.

## Decisión

**NO hacer merge a `main`.**

**NO promover a producción.**

El cierre final solo puede cambiar a `CHECKPOINT FINAL PASS` cuando Supabase real, SQL/E2E, Advisors, variables backend/smoke de producción y las validaciones externas críticas hayan sido resueltas o aceptadas explícitamente con evidencia.
