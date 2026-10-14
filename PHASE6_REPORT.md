# Valeibol — Reporte técnico Fase 6

Fecha del checkpoint: 2026-10-14  
Alcance: **operación administrativa real + pizarra digital semanal**.  
Estado: **Fase 6 cerrada; Fase 7 no iniciada**.

## 1. Objetivo cumplido

Se convirtió el panel autenticado de Fase 5 en una herramienta operativa sin abrir CRUD genérico al navegador. El personal autorizado puede consultar una pizarra semanal privada, confirmar/cancelar solicitudes, crear reservas manuales, editar reservas cuando su rol lo permite y bloquear/desbloquear horarios. La web pública conserva la política de privacidad: únicamente muestra `Disponible`, `Ocupado` o `No disponible`.

Se preservan las decisiones anteriores:

- mobile-first y dark mode;
- disponibilidad como función principal;
- S/35/h sin luz y S/60/h con luz;
- `America/Lima`;
- horario 08:00–23:00 todavía marcado **provisional/configurable**;
- solicitudes públicas nacen `pending`, bloquean agenda y no equivalen a confirmación;
- ninguna PII en la vista pública;
- Supabase Auth + perfiles `owner/admin/staff`;
- sin service-role en frontend.

## 2. Decisiones técnicas de Fase 6

### Pizarra privada

Nueva ruta funcional:

- `/admin/disponibilidad`

Escritorio muestra 7 días simultáneamente. En móvil/tablet la UI usa selector horizontal de días + slots verticales. La pizarra distingue:

- Disponible
- Pendiente
- Confirmada
- Bloqueada
- Completada
- No disponible

Los registros cancelados quedan como historial liberado y ya no bloquean un slot.

### Política de permisos

| Operación | owner | admin | staff |
|---|:---:|:---:|:---:|
| Ver pizarra y PII del negocio | ✓ | ✓ | ✓ |
| Confirmar `pending` | ✓ | ✓ | ✓ |
| Cancelar `pending/confirmed` | ✓ | ✓ | ✓ |
| Crear reserva manual | ✓ | ✓ | ✓ |
| Crear bloqueo | ✓ | ✓ | ✓ |
| Desbloquear | ✓ | ✓ | ✓ |
| Editar reserva existente | ✓ | ✓ | — |

La interfaz aplica esta matriz para UX, pero PostgreSQL vuelve a comprobarla. `staff` no puede eludirla llamando directamente la RPC de edición.

### Mutaciones específicas; no CRUD genérico

La migración `202610140004_phase6_admin_operations.sql` añade:

- `get_admin_schedule(date,date)`
- `admin_confirm_reservation(uuid)`
- `admin_cancel_reservation(uuid)`
- `admin_create_manual_reservation(...)`
- `admin_edit_reservation(...)`
- `admin_create_schedule_block(...)`
- `admin_cancel_schedule_block(uuid)`

Todas derivan usuario, negocio y rol desde `auth.uid()` + `profiles`. Ninguna mutación recibe del navegador `business_id`, `hourly_rate`, `total_amount` ni un `status` arbitrario.

`authenticated` continúa sin `INSERT/UPDATE/DELETE` genérico sobre las tablas administrativas.

### Fuente de verdad anti-solapamiento

Se conserva la arquitectura de Fase 3:

```text
reservations / schedule_blocks
          ↓ trigger
court_schedule_entries
          ↓
EXCLUDE USING gist (
  court_id WITH =,
  tstzrange(start_at,end_at,'[)') WITH &&
)
WHERE blocks_availability
```

Consecuencias:

- solapamiento parcial → rechazado;
- solapamiento total → rechazado;
- intervalos contiguos, p. ej. `18:00–20:00` y `20:00–21:00` → permitidos;
- reserva manual contra bloqueo concurrente → como máximo una ocupación válida.

### Confirmar no duplica ocupación

`pending` ya bloquea desde Fase 4. Confirmar solo cambia:

```text
pending -> confirmed
```

El trigger actualiza la misma entrada del ledger por `(source_kind, source_id)`. No crea una segunda ocupación.

Confirmar una `confirmed` es idempotente.

### Cancelar libera

`pending` o `confirmed` puede pasar a `cancelled`. El trigger conserva el registro histórico pero deja `blocks_availability=false`, por lo que el intervalo vuelve a estar disponible si no existe otra ocupación.

Cancelar nuevamente una `cancelled` es idempotente. `completed` no puede cancelarse en esta fase.

### Tarifa autoritativa

La UI muestra la estimación centralizada S/35 o S/60, pero PostgreSQL vuelve a consultar `pricing_rules`. Las RPC de creación/edición no aceptan precio ni total del navegador.

### Trazabilidad

Se añadieron a reservas y bloqueos:

- `last_modified_by`
- `status_changed_at`

Se conservan `created_by`, `created_at` y `updated_at` existentes. La reserva manual y los bloqueos registran el actor autenticado.

## 3. Integración público ↔ admin

Después de cada mutación, las Server Actions revalidan:

- `/`
- `/admin`
- `/admin/reservas`
- `/admin/disponibilidad`

La disponibilidad pública sigue leyendo únicamente la RPC sanitizada. Fase 6 añade `availability_revisions`, una señal Supabase Realtime sin horarios, estados ni PII. Los cambios del ledger incrementan esa revisión y una pestaña pública conectada vuelve a consultar inmediatamente la RPC sanitizada. Foco/visibilidad y polling de 30 s quedan como fallback si Realtime se desconecta.

No se añadió acceso público a `customers`, `reservations`, `schedule_blocks`, `profiles` ni a la pizarra administrativa.

## 4. Estados UX implementados

- carga/transición de acciones;
- éxito y error comprensibles;
- sesión expirada durante mutación → mensaje y redirección a login;
- permisos insuficientes;
- conflictos de agenda;
- errores de red;
- estado vacío sin canchas;
- confirmación destructiva antes de cancelar/desbloquear;
- Escape para cerrar modal;
- foco visible;
- `role=dialog`, `aria-modal`, leyendas y tabs/días accesibles;
- responsive 360, 390, 430, tablet y desktop mediante breakpoints existentes/nuevos.

No se simula ninguna operación administrativa si Supabase/Auth no está configurado.

## 5. Archivos nuevos

- `app/admin/(protected)/actions.ts`
- `app/admin/(protected)/disponibilidad/page.tsx`
- `components/admin/AdminReservationActions.tsx`
- `components/admin/AdminScheduleBoard.tsx`
- `lib/admin/operations.ts`
- `lib/admin/schedule.ts`
- `lib/data/adminOperationsService.ts`
- `lib/data/availabilityRealtime.ts`
- `lib/data/repositories/adminOperationsRepository.ts`
- `lib/data/repositories/supabaseAdminOperationsRepository.ts`
- `supabase/migrations/202610140004_phase6_admin_operations.sql`
- `supabase/tests/phase6.sql`
- `tests/admin-operations.test.ts`
- `scripts/integration-phase6-concurrency.mjs`
- `scripts/validate-phase6.mjs`
- `docs/PHASE6_OPERATIONS.md`
- `PHASE6_REPORT.md`

## 6. Archivos modificados

- `README.md`
- `package.json`
- `app/admin/(protected)/[module]/page.tsx`
- `app/admin/(protected)/page.tsx`
- `app/admin/(protected)/reservas/page.tsx`
- `app/globals.css`
- `components/availability/AvailabilityCalendar.tsx`
- `docs/ADMIN_AUTH_SETUP.md`
- `lib/availability.ts`
- `lib/data/repositories/mockAvailabilityRepository.ts`
- `lib/data/repositories/supabaseAvailabilityRepository.ts`
- `lib/data/supabase/database.types.ts`
- `lib/data/supabase/server.ts`

No se rediseñaron destructivamente las Fases 1–5.

## 7. Validaciones ejecutadas y aprobadas

### QA estático

Comando:

```bash
npm run qa
```

Resultado:

```text
QA estático Fase 6: PASS (39/39)
Unit tests: 36/36 PASS
0 FAIL
```

Los 36 tests totales incluyen regresión de Fases anteriores y nuevos casos de Fase 6:

- roles owner/admin/staff;
- `pending -> confirmed`;
- confirmación idempotente;
- `pending/confirmed -> cancelled`;
- liberación tras cancelar;
- bloqueo/desbloqueo;
- contigüidad sin falso conflicto;
- tarifas S/35/S/60;
- `America/Lima`;
- semana lunes-domingo;
- intervalos pasados;
- regresión de privacidad pública, disponibilidad y solicitud Fase 4.

### Sintaxis TypeScript/TSX independiente de dependencias

Se ejecutó `typescript.transpileModule` sobre 60 archivos TS/TSX:

```text
Transpile syntax: PASS (60 files, 0 errors)
```

### Script de concurrencia

```bash
node --check scripts/integration-phase6-concurrency.mjs
```

Resultado: PASS sintáctico.

### Comprobaciones estructurales SQL

- 10 funciones/trigger helpers de Fase 6 detectados tras añadir la señal Realtime;
- delimitadores `$$` balanceados;
- grants explícitos únicamente para las 7 RPCs administrativas/lectura esperadas;
- helpers internos sin EXECUTE para `anon/authenticated`;
- `availability_revisions` contiene solo identificador de negocio, revisión y timestamp, con escritura reservada al trigger.

Esto **no sustituye** ejecutar la migración en PostgreSQL real.

## 8. Comprobaciones bloqueadas por el entorno — NO marcadas como PASS

Se intentó instalar dependencias:

```bash
npm install --no-audit --no-fund --prefer-offline
```

El comando agotó el tiempo del entorno y `node_modules` no quedó disponible.

Por esa razón:

```text
npm run lint      -> eslint: not found     (exit 127)
npm run build     -> next: not found       (exit 127)
npm run typecheck -> no puede resolver React/Next/Supabase/@types/node
```

`typecheck` no se marca como aprobado: los errores observados son principalmente módulos/tipos ausentes por no haberse podido instalar dependencias.

Además:

```text
supabase --version -> command not found
psql --version     -> command not found
```

Por lo tanto **no se ejecutaron** en esta máquina:

- migración real Fase 6;
- `supabase/tests/phase6.sql` contra PostgreSQL;
- carrera integrada real de concurrencia;
- build de producción Next.js.

## 9. Comandos exactos para validar completamente en un entorno con dependencias

```bash
npm install
npm run qa
npm run lint
npm run typecheck
npm run build
```

Supabase local:

```bash
supabase start
supabase db reset
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

Concurrencia real Fase 6:

```bash
export NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='...'
export SUPABASE_SERVICE_ROLE_KEY='...'
npm run integration:phase6
```

La service-role se usa en ese script solo para crear/limpiar usuarios de prueba desde terminal segura; no pertenece al frontend ni a la aplicación normal.

## 10. Qué valida `phase6.sql`

El archivo preparado cubre, entre otros:

- `anon` rechazado para RPCs administrativas;
- DML directo sigue revocado;
- parámetros de RPC sin `business_id/precio/total/status` manipulables;
- confirmación `pending -> confirmed` con una sola fila de ledger;
- confirmación idempotente;
- cancelación y liberación;
- reserva manual con S/35 y S/60 calculados en servidor;
- staff rechazado al editar;
- owner autorizado al editar/recalcular;
- bloqueo/desbloqueo;
- solapamiento parcial/total rechazado;
- límites contiguos permitidos;
- usuario sin rol rechazado;
- PII disponible en pizarra privada y ausente en disponibilidad pública.

## 11. Qué valida la prueba de concurrencia preparada

`scripts/integration-phase6-concurrency.mjs` crea un usuario owner temporal y comprueba dos carreras reales:

1. dos reservas manuales simultáneas sobre el mismo intervalo → exactamente una debe ganar;
2. reserva manual y bloqueo simultáneos sobre el mismo intervalo → exactamente una operación debe ganar.

Después limpia los datos/usuario temporal.

## 12. Riesgos pendientes

1. **SQL aún no ejecutado contra PostgreSQL real en este entorno.** Es el riesgo principal antes de producción.
2. **Build/lint/typecheck completos pendientes** hasta disponer de dependencias npm.
3. La señal Realtime pública fue diseñada para no contener PII, pero su entrega websocket aún debe comprobarse contra un proyecto Supabase real; el polling de 30 s es el fallback.
4. El horario 08:00–23:00 sigue siendo provisional; debe reemplazarse cuando el propietario confirme horarios reales.
5. `completed` continúa siendo un estado histórico bloqueante según el modelo heredado; normalmente solo corresponde a intervalos ya pasados. No se implementó cierre automático de reservas en esta fase.
6. La matriz de permisos propuesta permite a `staff` confirmar/cancelar, crear manuales y bloquear; si el propietario desea un staff más limitado, debe ajustarse antes de producción.

## 13. Prueba manual solicitada

### Login → pizarra

1. Configurar Supabase y aplicar migraciones/seed.
2. Crear owner siguiendo `docs/ADMIN_AUTH_SETUP.md`.
3. Abrir `/admin` sin sesión: debe ir a `/admin/login`.
4. Iniciar sesión.
5. Abrir `/admin/disponibilidad`.
6. Revisar 7 días en desktop y selector horizontal en 360/390/430/tablet.

### Pending → confirmar → público

1. Desde la web pública crear una solicitud real en un horario libre.
2. Volver a `/admin/disponibilidad`.
3. Encontrar el slot `Pendiente`, con nombre/WhatsApp visibles solo allí.
4. Pulsar `Confirmar`.
5. Debe cambiar a `Confirmada` sin duplicar ocupación.
6. Abrir/refrescar la web pública: debe seguir `Ocupado` y no mostrar PII.

### Cancelar → liberar

1. Cancelar la reserva desde panel.
2. Confirmar la acción destructiva.
3. El registro pasa a `cancelled`/histórico liberado.
4. Refrescar la web pública: el horario debe volver a `Disponible` si no existe otra ocupación.

### Reserva manual

1. Pulsar `+ Reserva manual`.
2. Elegir cancha, fecha, inicio/fin, cliente, WhatsApp, modalidad y origen.
3. Ver estimación S/35 o S/60 por hora.
4. Guardar.
5. La base debe crearla `confirmed` y recalcular tarifa/total.
6. La web pública debe mostrar el intervalo como `Ocupado`.

### Bloquear/desbloquear

1. En un slot libre pulsar `Bloquear`.
2. Elegir motivo y nota opcional.
3. Guardar: panel → `Bloqueada`; público → `No disponible` sin motivo/PII.
4. Pulsar `Desbloquear` y confirmar.
5. El público vuelve a calcular disponibilidad.

### Logout

1. Pulsar `Cerrar sesión`.
2. Intentar volver a `/admin/disponibilidad`.
3. Debe redirigir al login y ninguna RPC administrativa debe funcionar como `anon`.

## 14. Alcance detenido

No se implementaron en Fase 6:

- gestión avanzada de clientes;
- ingresos/estadísticas;
- pagos;
- WhatsApp;
- campañas;
- reportes avanzados;
- automatizaciones.

**No se inició Fase 7.**
