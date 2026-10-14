# Valeibol · Fase 4 · Supabase y solicitud pública de reserva

## 1. Crear/configurar Supabase

Para el navegador solo se usan valores públicos:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_O_PUBLISHABLE_KEY
```

Cópialos a `.env.local`.

No expongas `SUPABASE_SERVICE_ROLE_KEY` en variables `NEXT_PUBLIC_*`. La Fase 4 no necesita una service-role key en frontend.

## 2. Aplicar migraciones

Con Supabase CLI:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Para local:

```bash
supabase start
supabase db reset
```

El reset aplica, en orden:

1. `202610140001_phase3_core.sql`
2. `202610140002_phase4_public_booking.sql`
3. `supabase/seed.sql`

## 3. Modelo conservado

Se mantienen:

- `businesses`
- `courts`
- `profiles`
- `operating_hours`
- `pricing_rules`
- `customers`
- `reservations`
- `schedule_blocks`
- `court_schedule_entries`

Fase 4 añade de forma no destructiva:

- `businesses.booking_increment_minutes` (60 en el seed actual);
- `reservations.request_token` para idempotencia;
- `get_public_booking_context(...)`;
- `create_public_reservation_request(...)`.

## 4. Seed de desarrollo

El seed no inventa clientes ni reservas. Solo crea:

- Valeibol;
- una cancha demo/provisional;
- horario **provisional** 08:00–23:00, lunes a domingo;
- incremento de reserva de 60 min;
- tarifas confirmadas S/35/h sin luz y S/60/h con luz.

El horario 08:00–23:00 **no se presenta como horario real confirmado del negocio**. Debe sustituirse cuando el propietario confirme su horario.

## 5. Política `pending`

Una solicitud pública se crea con:

```text
status = pending
```

Fase 3 ya sincroniza `pending`, `confirmed` y `completed` al ledger `court_schedule_entries` con `blocks_availability = true`.

Resultado: una solicitud pendiente deja de aparecer libre inmediatamente. Esto evita que dos clientes acumulen solicitudes válidas para el mismo intervalo antes de que el dueño revise la primera.

`cancelled` libera el intervalo. La UI administrativa para ejecutar esa transición llegará en fases posteriores.

## 6. Qué valida la base de datos

`create_public_reservation_request` no confía en la UI. Valida otra vez:

- negocio activo;
- cancha activa perteneciente al negocio;
- fecha y rango válidos;
- horario de operación aplicable a esa fecha;
- rango dentro de apertura/cierre;
- granularidad de reserva;
- fecha/hora no pasada;
- tarifa vigente por cancha + `lighting`;
- solapamiento con reservas/bloqueos mediante el ledger y `EXCLUDE USING gist`;
- formato E.164 del WhatsApp;
- longitud mínima/máxima del nombre.

El RPC **no recibe `hourly_rate`, precio ni total**. La base de datos lee `pricing_rules` y calcula `total_amount` dentro de la transacción.

## 7. Concurrencia y doble reserva

La protección no depende del color verde del frontend.

Flujo:

```text
INSERT reservation pending
        ↓
trigger de Fase 3
        ↓
INSERT court_schedule_entries
        ↓
EXCLUDE (court_id + tstzrange)
```

Dos transacciones que intentan ocupar el mismo rango no pueden comprometer ambas. Una gana; la otra recibe `23P01 / slot_unavailable`.

Además, `request_token` hace idempotente un retry de la misma solicitud: una pérdida de respuesta de red no debe generar una segunda reserva.

## 8. Privacidad y RLS

`anon` no tiene lectura/escritura directa sobre:

- `customers`;
- `reservations`;
- `schedule_blocks`;
- `court_schedule_entries`.

La lectura pública sigue pasando por `get_public_availability`, que solo devuelve intervalos sanitizados:

```json
{
  "startAt": "...",
  "endAt": "...",
  "kind": "reservation"
}
```

No devuelve nombre, teléfono, `customer_id`, notas internas, `created_by` ni otros datos administrativos.

La única escritura pública autorizada es ejecutar `create_public_reservation_request`, que tiene parámetros limitados y validación interna.

## 9. Probar manualmente el flujo real

1. Arranca Supabase local y resetea:

```bash
supabase start
supabase db reset
```

2. Crea `.env.local` con la URL y anon key local.

3. Instala y levanta Next:

```bash
npm install
npm run dev
```

4. Abre la web y ve a `Disponibilidad`.
5. Elige un slot verde futuro y pulsa **Solicitar**.
6. Comprueba que aparecen cancha, fecha e inicio correctos.
7. Cambia la hora final: solo deben ofrecerse bloques verdes consecutivos.
8. Prueba `Sin luz`: 1 h => S/35; 2 h => S/70.
9. Prueba `Con luz`: 1 h => S/60; 2 h => S/120.
10. Introduce nombre y WhatsApp y envía.
11. Debes ver `Solicitud recibida` y estado `Pendiente`.
12. El calendario debe revalidarse y mostrar ese rango como `Ocupado`.
13. En Supabase, la fila existe en `reservations`, pero el navegador público no puede leer esa tabla.
14. Verifica que la RPC pública de disponibilidad no contiene nombre ni teléfono.

## 10. Probar modo demo

Elimina temporalmente las dos variables `NEXT_PUBLIC_SUPABASE_*` y arranca la app.

Debe verse:

```text
Modo demostración · Supabase no configurado
```

Al solicitar:

```text
Probar solicitud (no guarda)
```

El resultado debe indicar expresamente que **no se guardó ninguna reserva**. El calendario demo no debe fingir persistencia.

## 11. Tests automatizados

Unitarios + QA estático:

```bash
npm run qa
```

SQL local:

```bash
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

El SQL comprueba, entre otros:

- anon sin acceso directo a PII;
- RPC pública disponible;
- ausencia de precio/total en argumentos públicos;
- S/35 y S/60 resueltos por servidor;
- `pending` reflejada como ocupación sanitizada;
- horario provisional explícito;
- día cerrado rechazado;
- pasado/fuera de horario/incremento inválido rechazados;
- solapamientos parciales y totales rechazados;
- intervalos contiguos permitidos;
- idempotencia por `request_token`.

Concurrencia real mediante dos llamadas simultáneas:

```bash
# Ejecutar después de supabase db reset
npm run integration:phase4
```

El test exige 1 éxito y 1 rechazo, y luego comprueba que la disponibilidad pública quedó ocupada sin PII.

## 12. Limitación de abuso que queda para producción

Esta fase limita la superficie mediante RPC, validación estricta, idempotencia y bloqueo de dobles reservas. Todavía no existe verificación de propiedad del número de WhatsApp ni rate limiting distribuido por IP/identidad.

Antes de un lanzamiento de alto tráfico conviene añadir una capa de rate limiting/anti-bot en servidor/edge y, si el negocio lo requiere, verificación del teléfono. No se ha simulado esa protección como si ya existiera.

## Fase 7 — Clientes, tarifas y métricas

Después de aplicar `202610140005_phase7_customers_pricing_metrics.sql` quedan disponibles:

- `get_public_pricing_for_date(text,date)` para precios públicos sanitizados por fecha;
- `get_admin_customers(integer)` y `get_admin_customer_history(uuid,integer)` para PII privada;
- `get_admin_pricing_rules()` para lectura versionada;
- `admin_schedule_pricing_rule(...)` para owner/admin;
- `get_admin_operational_metrics(date,date)` para resumen/actividad.

Ejecuta la regresión completa:

```bash
supabase db reset
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

La Fase 7 no requiere ninguna `service-role` en el navegador. La anon key solo puede ejecutar las RPC públicas sanitizadas previstas.
