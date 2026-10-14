# Valeibol · pendientes externos

Actualizado el 2026-10-14. No contiene secretos.

## Regla de integración

**Merge a `main` cuando un bloque funcional esté terminado y probado.**

Un bloqueo en otro bloque no impide integrar uno ya terminado. Un bloque todavía dependiente de credenciales, permisos, cuota o validaciones críticas propias permanece fuera de `main`.

## Estado actual

- `main`: `40788e90f769311140def63e9d65fd8be2345a73`.
- Bloques 4–5: MERGED y probados.
- Bloque 7: MERGED y probado en modo dormante; activación Meta real pendiente.
- PR #4 / `work/final-checkpoint`: conserva únicamente Bloques 2, 3 y 6.
- Supabase real: BLOCKED; el conector devuelve 0 proyectos.
- SQL/E2E/concurrencia real: BLOCKED por ausencia de Supabase accesible.
- Producción backend: BLOCKED; el proyecto canónico tiene 0 variables de entorno.
- Protección de `main`: BLOCKED; la integración GitHub disponible no expone escritura administrativa.

## Bloque 2 — Supabase real / seguridad

**BLOCKED EXTERNO**

Evidencia:

- `Supabase list_projects` devuelve exactamente `{"projects":[]}`.
- No existe un `project_id` verificable en esta sesión.
- No se inventó ni se infirió un destino.
- En PR #4 están preparados el baseline transversal y validaciones de:
  - `SECURITY DEFINER` + `search_path = public, pg_temp`;
  - aislamiento PII;
  - roles owner/admin/staff;
  - DML administrativo por RPC;
  - escritura pública autoritativa server-side;
  - grants/revokes Data API.

Pendiente cuando Supabase sea visible:

1. identificar proyecto real;
2. comparar migraciones remotas con 001..007;
3. aplicar solo las faltantes;
4. ejecutar toda la suite SQL;
5. Security Advisors;
6. Performance Advisors;
7. corregir findings críticos;
8. generar tipos TypeScript desde el esquema remoto;
9. revisar backup/PITR según el plan real.

## Bloque 3 — E2E y concurrencia real

**BLOCKED EXTERNO**

PR #4 contiene pruebas para:

- pública vs pública;
- pública vs manual;
- manual vs manual;
- reserva vs bloqueo;
- edición hacia ocupado;
- confirmación/cancelación simultánea;
- pricing concurrente;
- idempotencia y manipulación de payload.

Pendiente: ejecutar la matriz contra el PostgreSQL/Supabase real. Los scripts fallan explícitamente si faltan credenciales; no convierten ausencia de entorno en PASS.

## Bloque 6 — producción / DevSecOps

**PARCIAL / BLOQUEADO**

### GitHub

- `main.protected = false`;
- required checks: ninguno;
- rulesets: `[]`;
- el conector disponible solo permite lectura de branch protection/rulesets.

Pendiente: activar PR obligatorio y required checks desde una integración con permisos administrativos.

### Vercel canónico

- proyecto: `valeibol-cajamarca`;
- project id: `prj_XAMLMdxEH8zqrwfSwdL8XSGQ9D5m`;
- alias: `valeibol-cajamarca-live.vercel.app`;
- variables: 0;
- hidden production envs: 0;
- connectors: 0.

`main` ya avanzó a `40788e90...`, pero producción sigue en el deployment del antiguo SHA `22b4270b...` porque Vercel devuelve `build-rate-limit` / cuota diaria de deployments.

El PR #4 conserva el cambio de política para que producción no caiga silenciosamente a mock si faltan Supabase/envs. Ese cambio NO se mergeará hasta configurar y probar el backend real.

### Proyecto archive

- proyecto: `valeibol-cajamarca-archive`;
- project id: `prj_1OCyUQNvFPJt8bpLny2Buez8OxqF`;
- se configuró de forma reversible:
  - `commandForIgnoringBuildStep = "exit 0"`;
  - `previewDeploymentsDisabled = true`.
- no se eliminó el proyecto;
- sus aliases históricos siguen presentes;
- el proyecto canónico y su alias no fueron modificados.

### Smoke pendiente

Cuando existan envs reales:

1. home HTTP 200;
2. disponibilidad desde Supabase real;
3. reserva controlada;
4. admin protegido;
5. RPC pública sin PII;
6. tablas privadas negadas;
7. `/privacidad`, robots y sitemap;
8. ausencia real de fallback mock;
9. runtime logs sin PII.

## Bloque 7 — WhatsApp

**MERGED / ACTIVACIÓN REAL PENDIENTE**

Merge: `40788e90f769311140def63e9d65fd8be2345a73`.

Validado antes del merge:

- CI completo PASS;
- Chrome/Axe PASS;
- Cloud API oficial;
- outbox privado;
- E.164;
- idempotencia;
- `FOR UPDATE SKIP LOCKED`;
- retry/backoff;
- stale processing recovery;
- auth del procesador con comparación constante;
- provider rejection/timeout/200 sin message id.

Sin credenciales, la integración queda dormante y no envía mensajes ni modifica reservas.

Activación real pendiente únicamente cuando existan credenciales/templates/números autorizados:

1. aplicar migración 007 al Supabase real;
2. configurar variables server-side;
3. verificar templates aprobados;
4. nueva solicitud → propietario;
5. confirmación/cancelación → cliente;
6. recordatorio;
7. comprobar `provider_message_id` y retry;
8. configurar scheduler seguro.

## Bloques 4–5

**MERGED / PASS**

Merge: `a04d8aeed465763629492337d6fa57abc441ab5a`.

Validación previa al merge:

- CI completo PASS;
- Chrome real + Axe;
- 360/390/430/768/1024/1440;
- 54 checks, 0 failures;
- sin overflow;
- targets >=44 px;
- Axe serious/critical = 0.

Contenido externo aún opcional: fotos reales del negocio y confirmación del horario oficial; no se inventaron.

## Cierre global

No se declara `CHECKPOINT FINAL PASS` mientras Bloques 2, 3 y 6 sigan bloqueados. Esto no impide continuar mergeando otros bloques individuales que cumplan la regla de integración.
