# Valeibol · Fase 7 — Clientes, Precios y métricas operativas

## Alcance

Fase 7 añade tres módulos administrativos sin alterar las invariantes de Fases 1–6:

1. **Clientes**: solo datos reales creados por reservas/solicitudes.
2. **Precios**: `pricing_rules` versionadas por fecha, con cambios únicamente por owner/admin.
3. **Resumen / Actividad**: métricas derivadas de reservas y agenda. No existe todavía contabilidad de pagos.

## Matriz de permisos

| Acción | Owner | Admin | Staff | Anon |
|---|:---:|:---:|:---:|:---:|
| Ver clientes e historial | ✓ | ✓ | ✓ | — |
| Ver tarifas e historial | ✓ | ✓ | ✓ | solo tarifa pública sanitizada |
| Programar nueva tarifa | ✓ | ✓ | — | — |
| Ver resumen/métricas | ✓ | ✓ | ✓ | — |
| Editar clientes | — | — | — | — |
| CRUD directo de pricing/reservas | — | — | — | — |

La autorización crítica vuelve a comprobarse dentro de PostgreSQL. El `business_id` se deriva desde `auth.uid() -> profiles` y no llega como parámetro manipulable del navegador.

## Semántica exacta de las métricas

- **Total de reservas**: todas las filas de `reservations` cuyo `start_at`, convertido a la zona horaria del negocio, cae dentro del periodo. Incluye canceladas para que el total sea auditable.
- **Pendientes**: `status = pending`. Bloquean la agenda pero todavía no son confirmadas.
- **Confirmadas**: `status = confirmed`.
- **Completadas**: `status = completed`.
- **Canceladas**: `status = cancelled`.
- **Horas pending**: duración de reservas pendientes.
- **Horas reservadas**: duración de `confirmed + completed`. Excluye pending y cancelled.
- **Valor confirmado/programado**: suma de `total_amount` de reservas `confirmed`. **No significa dinero cobrado.**
- **Valor completado**: suma de `total_amount` de reservas `completed`. **Tampoco prueba pago recibido.**
- **Capacidad abierta**: suma de horas configuradas como abiertas en `operating_hours` para todas las canchas activas y fechas del periodo.
- **Agenda ocupada**: horas de `court_schedule_entries` con `blocks_availability = true`; incluye reservas que bloquean y bloqueos operativos activos.
- **Ocupación de agenda**: `agenda_occupied_hours / open_capacity_hours × 100`, limitada visualmente a 100 %.
- **Dinero cobrado**: no disponible hasta una fase de pagos.

## Versionado de precios

`admin_schedule_pricing_rule(...)`:

- solo admite `court_id`, modalidad, nueva tarifa y fecha de inicio;
- no admite `business_id`, `total_amount`, `status` ni precio histórico de una reserva;
- rechaza fechas pasadas según `America/Lima` del negocio;
- serializa cambios concurrentes de la misma cancha/modalidad con advisory lock;
- cierra la regla anterior en `effective_from - 1`;
- inserta una nueva fila y conserva la anterior como histórico;
- si ya existe una regla futura, la nueva vigencia termina el día anterior a esa regla;
- nunca reescribe `reservations.hourly_rate` ni `reservations.total_amount` existentes.

Las nuevas reservas públicas y manuales siguen calculando la tarifa en PostgreSQL según la **fecha de la reserva**, no según un importe enviado desde el navegador.

## Tarifas públicas

La web pública consulta `get_public_pricing_for_date(slug, date)`:

- devuelve solo cancha, modalidad, tarifa, vigencia, moneda y estado de configuración;
- no devuelve clientes, teléfonos, reservas, perfiles ni notas;
- el formulario de reserva consulta la tarifa aplicable a la fecha seleccionada;
- si Supabase está configurado pero la tarifa no puede recuperarse, el formulario no debe asumir el fallback local;
- si Supabase no está configurado, se mantiene el modo demo claramente marcado con S/35 y S/60 de la configuración local.

## Flujo manual de prueba

1. Inicia Supabase y aplica migraciones: `supabase db reset`.
2. Crea/asocia un owner según `docs/ADMIN_AUTH_SETUP.md`.
3. Inicia sesión en `/admin/login`.
4. Crea una reserva real desde la web pública o una reserva manual desde la pizarra.
5. Abre `/admin/clientes` y verifica que el cliente aparezca sin crear datos ficticios.
6. Abre su historial y comprueba cancha, fecha, estado, modalidad, tarifa histórica y total.
7. Abre `/admin/precios`. Deben aparecer S/35 sin luz y S/60 con luz como reglas vigentes iniciales.
8. Como owner/admin, programa una nueva tarifa futura para una modalidad.
9. Verifica que la regla anterior conserve su fila histórica y fecha final.
10. Consulta una reserva existente anterior a la nueva vigencia: su `hourly_rate` y `total_amount` no deben cambiar.
11. Crea una nueva reserva cuya fecha caiga dentro de la nueva vigencia: PostgreSQL debe usar la nueva tarifa automáticamente.
12. Abre `/admin/ingresos`, filtra un periodo y contrasta conteos/horas/valores con las reservas existentes.
13. Verifica que nunca se etiquete un valor de reserva como dinero cobrado.
14. Abre la web pública y confirma que disponibilidad no contiene PII y que las tarifas vigentes vienen de Supabase cuando está configurado.
15. Cierra sesión y comprueba que `/admin/clientes`, `/admin/precios` y `/admin/ingresos` vuelven a requerir autenticación.

## Validación reproducible

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
