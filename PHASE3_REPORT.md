# Valeibol — Reporte técnico Fase 3

## Resultado

Fase 3 completada sobre el checkpoint de Fase 2. Se añadió una capa real de datos preparada para Supabase/PostgreSQL sin avanzar al flujo persistente de reserva de Fase 4.

La web pública conserva los principios aprobados:

- mobile-first;
- disponibilidad como protagonista;
- 7 días en escritorio y selector móvil;
- S/35/h sin luz y S/60/h con luz;
- timezone `America/Lima`;
- horario de apertura todavía provisional/configurable;
- cero PII en la vista pública;
- fallback demostrativo claramente identificado cuando Supabase no está configurado.

## Arquitectura implementada

### Base de datos

Migración principal:

`supabase/migrations/202610140001_phase3_core.sql`

Entidades:

- `businesses`: configuración del negocio y timezone.
- `courts`: varias canchas desde el modelo, aunque la UI todavía usa la primera activa.
- `profiles`: vínculo entre Supabase Auth y rol administrativo.
- `operating_hours`: horarios versionables por cancha/día y estado provisional/confirmado.
- `pricing_rules`: tarifas versionables por cancha y modalidad de luz.
- `customers`: PII aislada de la vista pública.
- `reservations`: reservas con tarifa histórica, estado y origen.
- `schedule_blocks`: mantenimiento/academia/torneo/evento/cierre/otro.
- `court_schedule_entries`: ledger interno único de ocupación.

### Prevención de dobles reservas

No se confía en que el botón del frontend esté verde.

`court_schedule_entries` utiliza:

- `btree_gist`;
- `tstzrange(start_at, end_at, '[)')`;
- `EXCLUDE USING gist` por `court_id`.

Reservas y bloqueos se sincronizan en ese ledger mediante triggers `SECURITY DEFINER`. Así ambos tipos de evento compiten contra la misma restricción atómica. Una reserva que se cruce con otra reserva o con un bloqueo hace fallar la transacción.

Los intervalos usan semántica `[inicio, fin)`, por lo que 19:00–20:00 y 20:00–21:00 son adyacentes y válidos.

### Privacidad y RLS

RLS está habilitado en todas las tablas.

`anon` no tiene acceso directo a:

- clientes;
- reservas;
- bloqueos;
- perfiles;
- tablas administrativas.

La web pública consume únicamente la RPC:

`get_public_availability(slug, from, to)`

La RPC devuelve datos sanitizados:

- negocio/timezone;
- cancha;
- fecha;
- apertura/cierre;
- estado provisional/confirmado;
- intervalos ocupados con inicio, fin y tipo (`reservation`/`block`).

No devuelve nombres, teléfonos, customer IDs, notas, created_by ni pagos.

`owner` y `admin` quedan preparados para gestión; `staff` para lectura administrativa futura.

### Capa de acceso a datos

Se separó la UI de Supabase mediante repositorios:

- `AvailabilityRepository`
- `MockAvailabilityRepository`
- `SupabaseAvailabilityRepository`
- `createPublicAvailabilityRepository()`

El componente `AvailabilityCalendar` no ejecuta SQL ni consulta tablas directamente.

Si existen:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

usa Supabase.

Si faltan, usa `mock-provisional` y lo anuncia visualmente como modo demostración. Si las credenciales existen pero Supabase falla, la app muestra error: no degrada silenciosamente a datos falsos.

## Seed

`supabase/seed.sql` crea:

- Valeibol;
- una cancha explícitamente marcada como demo/provisional;
- horario provisional 08:00–23:00 lunes-domingo;
- tarifa S/35 sin luz;
- tarifa S/60 con luz.

No crea clientes ni reservas ficticias.

## Archivos nuevos principales

- `supabase/config.toml`
- `supabase/migrations/202610140001_phase3_core.sql`
- `supabase/seed.sql`
- `supabase/tests/phase3.sql`
- `docs/SUPABASE_SETUP.md`
- `lib/data/supabase/browser.ts`
- `lib/data/supabase/server.ts`
- `lib/data/supabase/database.types.ts`
- `lib/data/repositories/availabilityRepository.ts`
- `lib/data/repositories/mockAvailabilityRepository.ts`
- `lib/data/repositories/supabaseAvailabilityRepository.ts`
- `lib/data/availabilityService.ts`
- `scripts/validate-phase3.mjs`
- `scripts/smoke-supabase.mjs`
- `PHASE3_REPORT.md`

## Archivos modificados

- `config/business.ts`
- `lib/availability.ts`
- `components/availability/AvailabilityCalendar.tsx`
- `app/page.tsx`
- `app/globals.css`
- `tests/availability.test.ts`
- `.env.example`
- `.gitignore`
- `package.json`
- `README.md`

Fase 1/2 no fue rehecha; solo se tocaron piezas necesarias para conectar la disponibilidad a la nueva capa de datos.

## Pruebas ejecutadas

### 1. QA estático Fase 3

Comando:

```bash
node scripts/validate-phase3.mjs
```

Resultado:

`PASS`

Comprueba esquema, RLS, ledger anti-solapamiento, RPC pública, ausencia de service-role en browser, precios, timezone, fallback y seed sin clientes/reservas inventadas.

### 2. Tests unitarios

Comando:

```bash
npm test
```

Resultado:

`12/12 PASS`

Casos incluidos:

- tarifas centralizadas;
- fallback provisional;
- semana lunes-domingo;
- navegación semanal y cambio de año;
- `America/Lima`;
- conversión local/UTC;
- ausencia de PII en slots públicos;
- bloques de 1 hora;
- reserva => `Ocupado`;
- bloqueo => `No disponible`;
- intersecciones parciales;
- día cerrado;
- contrato público de slots.

### 3. Typecheck del núcleo puro

Comando ejecutado:

```bash
tsc --noEmit --moduleResolution bundler --module esnext --target es2022 \
  --allowImportingTsExtensions --skipLibCheck lib/availability.ts config/business.ts
```

Resultado:

`PASS`

### 4. Instalación de dependencias / typecheck completo / build

Se intentó:

```bash
npm install --no-audit --no-fund
```

El entorno agotó el timeout al acceder al registry y no creó `node_modules`/lockfile.

Como consecuencia, `npm run typecheck` no puede resolver `react`, `next`, `@supabase/ssr` ni `@types/node`, y `npm run build` termina con `next: not found`.

**No se marcan esas validaciones como aprobadas.** No son evidencia de un fallo funcional del código: faltan dependencias que el entorno no pudo descargar.

Para reproducir en un equipo con acceso a npm:

```bash
npm install
npm run qa
npm run typecheck
npm run build
```

### 5. Migración PostgreSQL / RLS real

Este entorno no dispone de `supabase`, `psql`, `postgres`, `initdb` ni Docker, por lo que no fue posible ejecutar la migración contra un PostgreSQL real aquí.

Se dejó preparado:

```bash
supabase start
supabase db reset
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

`supabase/tests/phase3.sql` comprueba dentro de una transacción con rollback:

- seed sin clientes;
- privilegios de `anon`;
- RPC pública sin PII;
- rechazo reserva vs reserva;
- rechazo reserva vs bloqueo;
- intervalos adyacentes permitidos;
- cancelación que libera el intervalo.

### 6. Smoke test remoto

Preparado, no ejecutado por falta de credenciales reales:

```bash
npm run smoke:supabase
```

Comprueba desde la anon key que:

- la RPC pública responde;
- el payload no contiene PII;
- `anon` no puede leer directamente clientes/reservas/bloqueos.

## Riesgos pendientes

1. **Horario real no confirmado.** Continúa marcado como provisional tanto en config fallback como en seed.
2. **Migración no ejecutada en PostgreSQL real en este entorno.** Debe validarse con Supabase CLI antes de producción.
3. **Dependencias sin lockfile.** `npm install` debe completarse fuera de este entorno y generar/guardar `package-lock.json` antes de producción.
4. **UI multi-cancha todavía no existe.** El repositorio devuelve múltiples canchas, pero el calendario de Fase 3 visualiza la primera activa. Esto es intencional para no adelantar fases.
5. **Creación pública de reservas aún no existe.** Fase 4 deberá usar una RPC/transacción server-side que calcule tarifa y cree customer/reservation sin confiar en datos del navegador.
6. **Autenticación administrativa visual no está conectada todavía.** El esquema/roles están preparados; la implementación pertenece a Fase 5.
7. **Tipos Supabase son contrato mínimo manual.** Tras desplegar la migración conviene regenerarlos con Supabase CLI y verificar diferencias.

## Prueba manual recomendada

1. Instalar dependencias: `npm install`.
2. Levantar Supabase local: `supabase start`.
3. Resetear: `supabase db reset`.
4. Copiar URL + anon key local a `.env.local`.
5. Ejecutar `npm run dev`.
6. Abrir `/` y confirmar banda `Supabase conectado · horario aún provisional`.
7. Cambiar de semana y comprobar 7 días.
8. Insertar temporalmente una reserva/bloqueo desde Studio como administrador/postgres.
9. Recargar y comprobar: reserva => `Ocupado`; bloqueo => `No disponible`.
10. Confirmar que no aparecen nombres/teléfonos en Network ni UI pública.
11. Ejecutar `npm run smoke:supabase`.
12. Ejecutar `npm run supabase:test`.
13. Ejecutar `npm run typecheck` y `npm run build`.

## Estado final

**Fase 3 cerrada.**

No se implementó Fase 4 ni ninguna funcionalidad fuera del alcance solicitado.
