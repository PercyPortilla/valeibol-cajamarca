# Valeibol · Reporte técnico · Fase 4

## Estado

**Fase 4 completada en código y detenida antes de Fase 5.**

Esta fase implementa el flujo público de **solicitud de reserva** sobre la capa Supabase/PostgreSQL creada en Fase 3. No implementa todavía aprobación/cancelación desde un dashboard, WhatsApp, pagos, campañas, estadísticas ni automatizaciones.

## Decisiones funcionales

### 1. Una solicitud pública nace como `pending`

Una solicitud enviada por un visitante **no es una reserva confirmada**. Se crea con:

```text
status = pending
```

La confirmación o cancelación por el propietario pertenece a una fase posterior.

### 2. `pending` bloquea disponibilidad inmediatamente

Se tomó esta política de forma explícita para evitar que varias personas acumulen solicitudes válidas sobre el mismo intervalo antes de que el propietario revise la primera.

Fase 3 ya sincroniza `pending`, `confirmed` y `completed` con `court_schedule_entries`. El ledger posee una restricción PostgreSQL `EXCLUDE USING gist` sobre cancha + rango temporal. Por tanto, una solicitud pendiente ocupa el intervalo a efectos de disponibilidad pública y una segunda solicitud solapada es rechazada a nivel de base de datos.

`cancelled` deja de bloquear. La UI administrativa para cambiar esos estados no forma parte de Fase 4.

### 3. El navegador no decide el precio

La UI muestra una estimación usando la configuración comercial centralizada:

- Sin luz: **S/35/h**
- Con luz: **S/60/h**

Pero la RPC pública **no recibe `hourly_rate`, precio ni total**. PostgreSQL vuelve a resolver la tarifa vigente desde `pricing_rules`, calcula la duración y el total y devuelve los valores validados por servidor.

### 4. Creación transaccional e idempotente

`create_public_reservation_request(...)` realiza dentro de la base de datos:

1. validación del negocio;
2. validación de cancha;
3. validación de fecha, apertura y cierre;
4. validación de granularidad del horario;
5. rechazo de fechas/horas pasadas;
6. resolución de tarifa;
7. creación/reutilización del cliente por teléfono dentro del negocio;
8. creación de la solicitud `pending`;
9. inserción automática en el ledger mediante trigger;
10. rechazo de solapamientos por la restricción de exclusión.

El cliente genera además un `request_token` UUID. Un reintento de la misma operación no debe duplicar la solicitud.

### 5. Modo demo sin persistencia falsa

Si faltan las variables `NEXT_PUBLIC_SUPABASE_*`, se mantiene el fallback provisional de fases anteriores. El formulario permite probar selección y cálculos, pero el resultado declara expresamente que **no se guardó ninguna solicitud** y el calendario demo no finge una actualización persistente.

### 6. Privacidad pública

La web pública continúa sin leer directamente `customers`, `reservations`, `schedule_blocks` o `court_schedule_entries`.

`anon` solo puede ejecutar RPCs públicas controladas. La disponibilidad pública devuelve intervalos sanitizados y nunca nombres, teléfonos, notas, `customer_id` ni perfiles administrativos.

No se usa `SUPABASE_SERVICE_ROLE_KEY` en frontend ni existe una clave real versionada.

## Cambios de base de datos

Nueva migración:

```text
supabase/migrations/202610140002_phase4_public_booking.sql
```

Añade sin rediseñar destructivamente Fase 3:

- `businesses.booking_increment_minutes`;
- `reservations.request_token`;
- índice único parcial para idempotencia;
- `get_public_booking_context(...)`;
- `create_public_reservation_request(...)`;
- permisos `EXECUTE` mínimos para `anon`/`authenticated`;
- revocación explícita de acceso directo anónimo a tablas con PII.

El seed conserva:

- horario **provisional/demo** 08:00–23:00, lunes a domingo;
- incremento de 60 minutos;
- S/35/h sin luz;
- S/60/h con luz;
- ninguna persona ni reserva ficticia.

El horario no debe interpretarse como horario real confirmado de Valeibol.

## Flujo público implementado

```text
slot realmente Disponible
        ↓
Solicitar
        ↓
fecha + cancha + inicio
        ↓
fin entre bloques consecutivos disponibles
        ↓
Sin luz / Con luz
        ↓
nombre + WhatsApp
        ↓
duración + estimación de total
        ↓
RPC de Supabase
        ↓
validación y cálculo en PostgreSQL
        ↓
reservation = pending
        ↓
ledger bloquea intervalo
        ↓
respuesta sanitizada
        ↓
calendario revalida disponibilidad
```

El formulario no puede abrirse desde un slot ocupado, bloqueado o pasado.

## Archivos modificados respecto a Fase 3

- `README.md`
- `app/globals.css`
- `app/page.tsx`
- `components/availability/AvailabilityCalendar.tsx`
- `docs/SUPABASE_SETUP.md`
- `lib/data/supabase/database.types.ts`
- `package.json`
- `preview/app.js`
- `preview/index.html`
- `supabase/seed.sql`

## Archivos añadidos

- `components/booking/ReservationDialog.tsx`
- `lib/booking.ts`
- `lib/data/bookingService.ts`
- `lib/data/repositories/bookingRepository.ts`
- `lib/data/repositories/mockBookingRepository.ts`
- `lib/data/repositories/supabaseBookingRepository.ts`
- `scripts/integration-phase4-concurrency.mjs`
- `scripts/validate-phase4.mjs`
- `supabase/migrations/202610140002_phase4_public_booking.sql`
- `supabase/tests/phase4.sql`
- `tests/booking.test.ts`
- `PHASE4_REPORT.md`

## Validaciones ejecutadas en este entorno

### QA estático

```text
npm run qa
QA estático Fase 4: PASS (27/27)
Tests unitarios: 18/18 PASS
```

El QA comprueba, entre otros:

- S/35 y S/60 centralizados;
- `America/Lima`;
- horario fallback marcado provisional;
- `pending` bloquea disponibilidad;
- RPC pública presente;
- precio/total ausentes de los parámetros públicos;
- tarifa resuelta desde `pricing_rules`;
- validación de `operating_hours`;
- rechazo server-side de pasado;
- traducción de solapamiento a `slot_unavailable`;
- idempotencia;
- ausencia de lectura anónima directa de PII;
- UI desacoplada mediante repositorio;
- demo no persistente;
- CTA solo en `available`;
- revalidación posterior;
- breakpoints 360/390/430 y móvil;
- diálogo nativo accesible.

### Tests unitarios

18 pruebas pasan. Incluyen:

- cálculo de S/35 por 1 h sin luz;
- cálculo de S/60/h y S/120 por 2 h con luz;
- normalización de WhatsApp peruano;
- selección de fines consecutivos únicamente sobre slots disponibles;
- `America/Lima` y conversión temporal;
- detección de horarios pasados;
- derivación de Ocupado/No disponible sin PII;
- cambio de semana y cruce de mes/año;
- días cerrados;
- intersecciones parciales.

### JavaScript auxiliar

Se verificó sintaxis de:

```text
preview/app.js
scripts/integration-phase4-concurrency.mjs
```

### Revisión de secretos

No se encontró ninguna service-role key real versionada. `.env.example` contiene únicamente nombres de variables vacías y advertencias.

## Pruebas preparadas pero no ejecutables aquí

### Typecheck real con dependencias

`npm run typecheck` no puede completarse correctamente porque este entorno no tiene las dependencias del proyecto instaladas. El resultado contiene principalmente módulos/tipos ausentes (`react`, `next`, `@supabase/ssr`, tipos Node/JSX).

Durante el desarrollo se realizó además una comprobación temporal de sintaxis/tipos internos con stubs de dependencias para detectar incompatibilidades propias del código, pero **esto no sustituye** el typecheck real.

Reproducir después de instalar dependencias:

```bash
npm install
npm run typecheck
```

### Build de producción

No fue posible ejecutar `next build` porque `next` no está instalado en este contenedor:

```text
npm run build
sh: 1: next: not found
```

Reproducir:

```bash
npm install
npm run build
```

### Migraciones y tests SQL reales

No están disponibles `supabase` CLI ni `psql` en este entorno, por lo que **no se marca como aprobada** la ejecución real de las migraciones/RLS/RPC contra PostgreSQL.

Se preparó:

```text
supabase/tests/phase4.sql
```

Este test comprueba:

- `anon` sin lectura/escritura directa de PII;
- ejecución permitida de la RPC controlada;
- ausencia de precio/total en argumentos;
- cálculo server-side S/35 y S/60;
- `pending` visible únicamente como intervalo ocupado sanitizado;
- rechazo de día cerrado;
- rechazo de pasado/fuera de horario/incremento inválido;
- solapamiento parcial y total rechazados;
- límites contiguos permitidos;
- idempotencia por `request_token`.

Ejecutar localmente:

```bash
supabase start
supabase db reset
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

### Concurrencia real

Se preparó:

```text
scripts/integration-phase4-concurrency.mjs
```

Lanza dos solicitudes anónimas simultáneas sobre el mismo intervalo y exige exactamente:

```text
1 éxito
1 rechazo slot_unavailable / 23P01
```

Después verifica que la disponibilidad pública esté ocupada y siga sin PII.

Ejecutar tras `supabase db reset` y configurar las variables públicas:

```bash
npm run integration:phase4
```

No se marca esta prueba como pasada en este entorno porque Supabase local no está disponible.

## Prueba manual paso a paso

### Con Supabase real/local

1. Instala dependencias:

```bash
npm install
```

2. Arranca/resetea Supabase:

```bash
supabase start
supabase db reset
```

3. Crea `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

4. Ejecuta:

```bash
npm run dev
```

5. Abre la página pública y ve a **Disponibilidad**.
6. Navega a un día futuro y selecciona un slot verde.
7. Pulsa **Solicitar**.
8. Comprueba que fecha, cancha e inicio coinciden con el slot elegido.
9. Selecciona una hora final. No deben aparecer opciones posteriores a un hueco ocupado/bloqueado.
10. Selecciona **Sin luz** y comprueba S/35 por 1 h; selecciona **Con luz** y comprueba S/60 por 1 h.
11. Para 2 h con luz, comprueba estimación S/120.
12. Introduce nombre y WhatsApp válidos.
13. Envía una sola vez. El botón debe mostrar estado de carga y evitar doble submit accidental.
14. La respuesta real debe indicar **Solicitud recibida · Pendiente**, no “Reserva confirmada”.
15. El total mostrado tras el éxito debe ser el devuelto por el servidor.
16. El calendario debe recargar y ese intervalo debe dejar de estar disponible.
17. Intenta el mismo rango desde otra pestaña: debe fallar como no disponible/solapamiento.
18. Comprueba en Supabase que existe la solicitud `pending`.
19. Con anon key, intenta `select` directo sobre `customers` y `reservations`: debe denegarse/no devolver datos según RLS/permisos.
20. Llama a disponibilidad pública: debe mostrar solo intervalos sanitizados, nunca nombre ni teléfono.

### Sin credenciales Supabase

1. Deja vacías las variables `NEXT_PUBLIC_SUPABASE_*`.
2. Ejecuta la web.
3. Debe aparecer el aviso **Modo demostración / datos provisionales**.
4. Abre un slot disponible y completa el formulario.
5. El resultado debe decir que fue una **simulación** y que no se guardó ninguna reserva.

## Riesgos pendientes

1. **Horario real aún no confirmado.** 08:00–23:00 es exclusivamente provisional/demo.
2. **No hay aprobación/cancelación administrativa todavía.** Una solicitud `pending` ocupa el horario hasta que una fase posterior permita al dueño gestionarla.
3. **No existe verificación de propiedad del WhatsApp.** Un visitante podría introducir un número que no le pertenezca.
4. **No existe rate limiting distribuido/anti-bot de producción** todavía. Hay validación estricta, idempotencia y protección de concurrencia, pero no sustituyen un control de abuso perimetral.
5. **Migraciones/RLS/concurrencia deben ejecutarse contra PostgreSQL real/local** antes de producción; están preparadas pero este entorno no dispone de Supabase CLI/psql.
6. **Build y typecheck reales requieren `npm install`**; el contenedor actual no consiguió disponer de las dependencias.

## Criterio de cierre

La Fase 4 queda cerrada cuando el checkpoint se considera la implementación de:

```text
cliente → slot disponible → cálculo → solicitud pending → persistencia segura → intervalo bloqueado → revalidación pública
```

La Fase 5 (autenticación/área administrativa) **no se ha iniciado**.
