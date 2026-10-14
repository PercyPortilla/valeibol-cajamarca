# Valeibol · Reporte Fase 7

## Resultado

Fase 7 implementada sobre el checkpoint completo de Fase 6 y detenida antes de Fase 8.

Se añadieron tres áreas operativas reales:

- **Clientes** con PII únicamente dentro del panel protegido, historial de reservas y agregados derivados.
- **Precios** con `pricing_rules` versionadas temporalmente, lectura para owner/admin/staff y mutación solo owner/admin.
- **Resumen / Actividad** con métricas reales por periodo y semántica explícita que evita presentar valor de reservas como dinero cobrado.

La web pública mantiene disponibilidad protagonista, `America/Lima`, horario provisional configurable, solicitudes `pending` bloqueantes y ausencia de PII.

## Decisiones técnicas principales

### 1. Clientes sin CRUD genérico

No se añadió edición de clientes en Fase 7. Las RPC privadas son de lectura:

- `get_admin_customers(p_limit)`
- `get_admin_customer_history(p_customer_id,p_limit)`

Ambas derivan el negocio desde `auth.uid() -> profiles -> business_id` mediante el contexto interno ya existente. Ninguna acepta `business_id` desde el navegador.

Agregados incluidos:

- número total de reservas;
- activas (`pending + confirmed`);
- completadas;
- canceladas;
- última actividad;
- última reserva no cancelada;
- valor confirmed;
- valor completed.

Los importes no se presentan como pagos.

### 2. Precios versionados, no sobrescritos

Se añadió `admin_schedule_pricing_rule(...)`.

La RPC:

- solo admite cancha, modalidad, nueva tarifa y fecha de vigencia;
- vuelve a derivar negocio/rol desde sesión;
- limita escritura a `owner/admin`;
- rechaza `staff` a nivel PostgreSQL;
- impide fechas pasadas según timezone del negocio;
- serializa cambios concurrentes de una misma cancha/modalidad;
- cierra la regla anterior en `nueva_fecha - 1`;
- inserta una nueva fila, preservando histórico;
- no modifica `reservations.hourly_rate` ni `reservations.total_amount` existentes.

Se agregó `created_by` a `pricing_rules` para trazabilidad de nuevas versiones.

### 3. Precio público por fecha

Nueva RPC pública sanitizada:

`get_public_pricing_for_date(slug,date)`

La web pública y el modal de reserva pueden consultar la tarifa aplicable a la fecha seleccionada. Esto resuelve la divergencia que podría producirse si la UI siguiera mostrando para siempre S/35/S/60 después de programar una tarifa futura.

- Con Supabase activo: el Home obtiene la tarifa vigente desde PostgreSQL.
- Al abrir una reserva real: el modal obtiene la tarifa aplicable específicamente a la fecha elegida.
- Sin Supabase: se conserva el fallback demo claramente identificado con S/35/S/60.
- Con Supabase configurado pero fallo de lectura: no se finge que el fallback sea la tarifa real vigente.

El precio definitivo de una reserva continúa calculándose en PostgreSQL; la UI solo previsualiza.

### 4. Métricas sin confundir reservas con cobros

Nueva RPC:

`get_admin_operational_metrics(from,to)`

Métricas:

- `reservation_count`: todas las reservas del periodo, incluidas canceladas para auditabilidad;
- `pending_count`, `confirmed_count`, `completed_count`, `cancelled_count`;
- `pending_hours`;
- `reserved_hours`: `confirmed + completed`;
- `confirmed_value`: suma de `total_amount` confirmed;
- `completed_value`: suma de `total_amount` completed;
- `open_capacity_hours`: horas abiertas configuradas;
- `agenda_occupied_hours`: ledger con `blocks_availability=true`;
- `occupancy_percent`: ocupación / capacidad abierta.

**No existe todavía una métrica “dinero cobrado”** porque no hay un sistema de pagos que lo pruebe.

## Matriz de permisos Fase 7

| Función | Owner | Admin | Staff | Anon |
|---|:---:|:---:|:---:|:---:|
| Clientes: lista/historial | Sí | Sí | Sí | No |
| Precios: lectura | Sí | Sí | Sí | Solo RPC pública sanitizada |
| Precios: programar nueva vigencia | Sí | Sí | No | No |
| Resumen / métricas | Sí | Sí | Sí | No |
| Editar clientes | No implementado | No implementado | No implementado | No |
| DML directo pricing/customers/reservations | No | No | No | No |

## Archivos nuevos

- `supabase/migrations/202610140005_phase7_customers_pricing_metrics.sql`
- `supabase/tests/phase7.sql`
- `app/admin/(protected)/clientes/page.tsx`
- `app/admin/(protected)/precios/page.tsx`
- `app/admin/(protected)/ingresos/page.tsx`
- `components/admin/AdminPricingForm.tsx`
- `lib/admin/phase7.ts`
- `lib/data/phase7Service.ts`
- `lib/data/publicPricingService.ts`
- `lib/data/repositories/phase7Repository.ts`
- `lib/data/repositories/supabasePhase7Repository.ts`
- `tests/phase7.test.ts`
- `scripts/validate-phase7.mjs`
- `docs/PHASE7_OPERATIONS.md`
- `PHASE7_REPORT.md`

## Archivos modificados

- `README.md`
- `package.json`
- `app/page.tsx`
- `app/globals.css`
- `app/admin/(protected)/page.tsx`
- `app/admin/(protected)/actions.ts`
- `app/admin/(protected)/[module]/page.tsx`
- `components/booking/ReservationDialog.tsx`
- `lib/booking.ts`
- `lib/data/repositories/bookingRepository.ts`
- `lib/data/repositories/mockBookingRepository.ts`
- `lib/data/repositories/supabaseBookingRepository.ts`
- `lib/data/supabase/database.types.ts`
- `docs/SUPABASE_SETUP.md`

## Validación ejecutada

### QA estático Fase 7

`npm run qa` ejecuta primero `scripts/validate-phase7.mjs`.

Resultado:

- **17/17 PASS**

Incluye comprobaciones de migración, RPC privadas, permisos staff, precios versionados, tarifas públicas por fecha, separación repositorios/UI, actualización del Home/modal, tipos, responsive y ausencia de service-role.

### Unit/regression tests

Resultado:

- **42/42 PASS**
- 0 fallos

Conserva los tests anteriores de Fases 2–6 y añade:

- matriz owner/admin/staff Fase 7;
- S/35 y S/60 iniciales;
- cálculo de preview con tarifa dinámica futura;
- clasificación vigente/futura/histórica;
- firma segura de RPC de precios;
- ausencia de PII en RPC pública de precios.

### TypeScript

Existe `tsc` global (`5.8.3`) y se ejecutó `tsc --noEmit`.

No se puede marcar como typecheck aprobado porque `npm install` no pudo completarse y faltan los módulos/tipos del proyecto (`react`, `next`, `@supabase/ssr`, `@types/node`, etc.). La salida muestra esos módulos ausentes. No aparecieron errores sintácticos TS1xxx en el parseo realizado.

### npm install / lint / build

Intento real:

```text
npm install --no-audit --no-fund --prefer-offline
→ timeout del entorno
```

Por ello:

```text
npm run lint
→ eslint: not found

npm run build
→ next: not found
```

No se marcan como aprobados.

### PostgreSQL / Supabase real

El entorno actual no dispone de:

- `supabase` CLI;
- `psql`;
- Docker.

Por ello `supabase/tests/phase7.sql` está preparado pero **no ejecutado aquí**. Tampoco se marca como aprobado.

Comandos reproducibles:

```bash
npm install
npm run qa
npm run lint
npm run typecheck
npm run build

supabase start
supabase db reset
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

`phase7.sql` prueba, entre otros:

- anon sin PII/RPC admin;
- precios públicos S/35/S/60 iniciales;
- reserva histórica conserva tarifa tras cambio;
- nueva reserva usa nueva tarifa server-side;
- staff puede leer pero no modificar precios;
- owner/admin sí modifican mediante RPC específica;
- firma sin `business_id/total/status` manipulables;
- clientes/agregados reales;
- aislamiento por negocio;
- métricas y `America/Lima`;
- usuario autenticado sin perfil rechazado.

## Riesgos pendientes

1. **Migración no ejecutada contra PostgreSQL en este entorno.** Debe correrse `supabase db reset` antes de producción.
2. **Build/lint/typecheck completos pendientes** hasta instalar dependencias.
3. **Horario de apertura real sigue sin confirmarse.** Continúa correctamente marcado como provisional/configurable.
4. **No existe sistema de pagos.** Nunca asumir que `confirmed_value` o `completed_value` significa dinero recibido.
5. **No existe Fase 8/WhatsApp.** `marketing_opt_in` sigue almacenado, pero no dispara campañas ni mensajes.
6. El proyecto sigue siendo de un negocio operativo; aunque el modelo soporta `business_id`, esta fase no pretende completar multitenancy comercial.

## Prueba manual recomendada

Consulta `docs/PHASE7_OPERATIONS.md`. Flujo clave:

`login → Clientes → historial → Precios → nueva vigencia → verificar histórico → crear nueva reserva → verificar nueva tarifa → Resumen/Actividad → revisar web pública sin PII → logout`.

## Estado final

- Fase 1: completa
- Fase 2: completa
- Fase 3: completa
- Fase 4: completa
- Fase 5: completa
- Fase 6: completa
- **Fase 7: completa en código/checkpoint, con validaciones locales disponibles PASS y validaciones externas documentadas**
- Fase 8: **no iniciada**
