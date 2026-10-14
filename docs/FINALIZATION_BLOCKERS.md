# Valeibol · pendientes externos para cierre final

Actualizado el 2026-10-14. Este archivo registra únicamente validaciones que siguen bloqueadas o que dependen de servicios reales. No contiene secretos.

## Estado resumido

- Código del checkpoint: CI reproducible PASS.
- Responsive/accesibilidad del checkpoint actual: 54/54 checks PASS en Chrome/Axe.
- Supabase real: BLOCKED, el conector devuelve 0 proyectos.
- E2E/SQL real: BLOCKED por ausencia de proyecto/credenciales Supabase accesibles.
- Producción actual: FAIL crítico de cierre; sigue desplegando el `main` anterior y no tiene variables de entorno.
- Protección de `main`: BLOCKED por capacidades administrativas del conector GitHub.
- WhatsApp Meta real: BLOCKED; no hay credenciales/templates configurados en Vercel.
- Deploy final: NO AUTORIZADO mientras los bloqueos críticos anteriores sigan abiertos.

## 1. Supabase real — BLOCKED

Evidencia de la sesión:

- `Supabase list_projects` devuelve exactamente `{"projects":[]}`.
- Sin `project_id` no es seguro comparar/aplicar migraciones, ejecutar SQL remoto ni Advisors.
- No se ha inventado ni inferido un proyecto Supabase.
- La auditoría estática del repositorio sí pasa y exige:
  - `SECURITY DEFINER` con `search_path = public, pg_temp`;
  - aislamiento de PII;
  - DML administrativo solo por RPC;
  - roles owner/admin/staff;
  - escritura pública autoritativa solo por service role;
  - `REVOKE` + `GRANT SELECT` explícitos sobre `availability_revisions`, compatible con el cambio de Data API de Supabase previsto para 2026-10-30.

Pendiente cuando el proyecto sea visible:

1. identificar el proyecto real de Valeibol;
2. ejecutar `list_migrations` y comparar contra `001..007`;
3. aplicar solo migraciones faltantes;
4. ejecutar `npm run supabase:test`;
5. ejecutar `npm run integration:phase4`;
6. ejecutar `npm run integration:phase5`;
7. ejecutar `npm run integration:phase6`;
8. ejecutar `npm run integration:e2e`;
9. ejecutar Security Advisors;
10. ejecutar Performance Advisors;
11. corregir cualquier finding crítico;
12. regenerar tipos TypeScript desde el esquema remoto y revisar el diff;
13. revisar backups/PITR según el plan real del proyecto.

## 2. Vercel / producción — FAIL crítico + bloqueos externos

Proyecto canónico:

- proyecto: `valeibol-cajamarca`;
- project id: `prj_XAMLMdxEH8zqrwfSwdL8XSGQ9D5m`;
- alias público canónico actual: `valeibol-cajamarca-live.vercel.app`;
- producción actual: commit `22b4270b3b46d46802fe12bb45ba9b7b325b0799` de `main`.

Configuración observada:

- variables de entorno del proyecto canónico: `0`;
- `hiddenProductionEnvCount: 0`;
- conectores del proyecto: `0`;
- por tanto no hay configuración visible de Supabase ni WhatsApp en Vercel.

Smoke real de producción desde GitHub Actions:

- `/` → HTTP 200 PASS;
- `/admin` → HTTP 307 hacia `/admin/login?reason=config...` PASS como protección, pero `reason=config` confirma backend de auth no configurado;
- `/robots.txt` → HTTP 200 PASS;
- `/sitemap.xml` → HTTP 200 PASS;
- `/privacidad` → HTTP 404 FAIL porque producción sigue en el `main` anterior.

Auditoría visual real de producción:

- 360/390/430/768: layout, overflow y Axe serious/critical PASS;
- 1024/1440: FAIL de targets táctiles del header (<44 px), ya corregido en el checkpoint;
- capturas: artifact `11891228440`;
- la captura real muestra que producción aún usa `Disponibilidad referencial`, slots simulados y precios fallback S/35/S/60.

El checkpoint actual, en cambio, no cae a mock en producción: si Supabase falta muestra un error comercial controlado y no presenta disponibilidad/precio provisional como dato vigente.

Cuota de preview:

- primer preview manual del checkpoint: READY, deployment `dpl_BHSJr9V5XScu9Js4zgn6o696BMrp`, SHA `28d746cd15aa336fcc11e47440b85dc2c1a292fb`;
- al intentar un preview posterior del SHA corregido, Vercel devolvió:
  - HTTP 402 `payment_required`;
  - código `api-deployments-free-per-day`;
  - mensaje: más de 100 deployments, reintentar en 24 h;
  - `retryAfter: 86400`.
- Por esa cuota, el CSS corregido se validó con el mismo Chrome/Axe contra un `next start` construido desde el SHA actual.

Proyecto archive:

- proyecto: `valeibol-cajamarca-archive`;
- project id: `prj_1OCyUQNvFPJt8bpLny2Buez8OxqF`;
- también tenía builds automáticos de las mismas ramas y contribuía a duplicar consumo de cuota;
- se configuró `commandForIgnoringBuildStep = "exit 0"`, de forma reversible, para omitir nuevos builds;
- no se eliminó el proyecto ni se reasignaron dominios;
- aún conserva aliases históricos, incluido `valeibol-cajamarca.vercel.app`, por lo que cualquier consolidación/desasignación debe hacerse solo después del cierre real.

Observabilidad Vercel:

- lectura de runtime errors/logs mediante el conector: HTTP 403 por permisos;
- no se reintentó de forma insegura ni se asumió ausencia de errores.

Pendiente:

1. obtener/configurar variables reales de Supabase;
2. ejecutar `npm run smoke:production` con backend real;
3. repetir preview del SHA final cuando se libere la cuota;
4. solo después de validación total, decidir si reasignar/eliminar aliases históricos del archive;
5. revisar runtime logs cuando el scope del conector lo permita.

## 3. Protección de main — BLOCKED

Estado leído desde GitHub:

- `main.protected = false`;
- protection `enabled = false`;
- required status checks: ninguno;
- rulesets del repositorio: `[]`.

La integración GitHub disponible en esta sesión solo expone lectura para branch protection/rulesets y no una acción administrativa de escritura, por lo que no es posible activar la protección desde aquí.

Pendiente en GitHub:

- PR obligatorio;
- required checks antes de merge;
- como mínimo CI/QA/build;
- limitar push directo a `main` si el plan/configuración de la cuenta lo permite.

## 4. WhatsApp Business Platform — BLOCKED para prueba real

Código y tests locales/CI:

- Cloud API oficial;
- outbox privado;
- E.164;
- idempotencia;
- `FOR UPDATE SKIP LOCKED`;
- recovery de jobs `processing`;
- backoff;
- auth del procesador con comparación constante;
- rechazo de provider failure/timeout/respuesta 200 sin message id;
- secretos solo server-side.

Prueba Meta real no ejecutada porque:

- Vercel reporta 0 variables de entorno;
- no hay `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, templates aprobados ni `WHATSAPP_PROCESSOR_SECRET` visibles/configurados;
- no se han pedido ni expuesto secretos en chat;
- no se enviaron mensajes a números reales.

Pendiente cuando existan credenciales/templates autorizados:

1. nueva solicitud → propietario;
2. confirmación → cliente;
3. cancelación → cliente;
4. recordatorio;
5. comprobar `provider_message_id`;
6. comprobar retry real;
7. configurar scheduler seguro;
8. usar solo números autorizados por Meta.

## 5. Responsive y accesibilidad — PASS del checkpoint, alcance admin parcial

Evidencia del SHA corregido ejecutada con Chrome real + Axe:

- viewports: 360, 390, 430, 768, 1024 y 1440;
- homepage HTTP: PASS;
- sin overflow horizontal: PASS;
- secciones comerciales presentes: PASS;
- sin copy técnico visible: PASS;
- targets táctiles >=44 px: PASS;
- Axe `serious/critical`: 0;
- admin protegido y login responsive: PASS;
- admin login sin overflow: PASS;
- admin login Axe `serious/critical`: 0;
- total: 54 checks, 0 failures;
- capturas: artifact `11891053641`.

También se inspeccionaron visualmente las capturas 360, 1024 y 1440 del homepage y 360/1440 del login: sin clipping ni solapamientos visibles después del fix.

Alcance todavía bloqueado:

- no es posible inspeccionar visualmente pizarra/clientes/precios autenticados contra datos reales porque no existe Supabase/auth real accesible en esta sesión.

Contenido todavía externo:

- fotografías reales del negocio;
- confirmación del horario oficial del propietario.

Mientras falten fotos reales se mantienen placeholders; 08:00–23:00 sigue siendo provisional.

## Regla de cierre

No hacer merge final a `main`, no promover el checkpoint a producción y no declarar `CHECKPOINT FINAL PASS` mientras siga abierto cualquiera de estos puntos críticos:

- Supabase real no conectado/validado;
- SQL/E2E/concurrencia real no ejecutados;
- Advisors no ejecutados;
- variables backend de Vercel ausentes;
- smoke backend real de producción pendiente;
- prueba Meta real pendiente si se desea activar WhatsApp;
- protección de `main` no configurada o explícitamente aceptada como limitación.
