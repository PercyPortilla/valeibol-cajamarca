# Prompt operativo · Bloque 23 — Granularidad de reserva multi-tenant

Trabaja sobre B20–B22 ya validados. B23 hace administrable businesses.booking_increment_minutes y elimina la discrepancia entre la granularidad que valida PostgreSQL y los bloques que renderiza la agenda pública.

## Problema real

- La base soporta incrementos entre 15 y 240 minutos que dividan exactamente 1440.
- Reserva pública, phase6_resolve_window, pizarra admin y B22 ya usan el valor real del tenant.
- B20 crea negocios con el default 60 y no existe RPC/UI tenant para cambiarlo.
- La agenda pública construía slots con businessConfig.availability.slotMinutes aunque el tenant tuviera otro valor en DB.

## RPCs

### Lectura

get_admin_booking_settings():

- SECURITY DEFINER, search_path fijo;
- usa phase6_admin_actor();
- no recibe business_id;
- permite lectura a perfiles administrativos activos, incluido staff.

### Mutación

admin_update_booking_increment(p_booking_increment_minutes):

1. Derivar actor/tenant con phase6_admin_actor().
2. Exigir rol tenant owner o admin.
3. Validar 15..240 y 1440 % incremento = 0.
4. Bloquear businesses del tenant FOR UPDATE.
5. B22 debe compartir esa misma barrera (business FOR UPDATE antes de court FOR UPDATE) y validar con el booking_increment de la fila bloqueada; esto evita write-skew entre un cambio concurrente de horario y otro de granularidad.
6. No bloquear filas de reservas/bloqueos. La fila business es la barrera de serialización porque los flujos de booking toman el mismo business FOR SHARE; evitar invertir el orden reservation → business usado por operaciones existentes.
7. Antes de cambiar, revisar reservas futuras pending/confirmed y schedule_blocks futuros activos.
8. Resolver la versión de operating_hours aplicable a la fecha local de cada intervalo.
9. Usar tiempo local de pared para duración y offset desde opens_at, igual que phase6_resolve_window/B22; esto evita falsos conflictos en zonas con DST.
10. Rechazar si el nuevo incremento vuelve incompatible una reserva/bloqueo existente.
11. Actualizar businesses.booking_increment_minutes.
12. Incrementar availability_revisions una sola vez para refrescar calendarios públicos abiertos.

## Agenda pública

Reutilizar get_public_booking_context, que ya expone booking_increment_minutes. SupabaseAvailabilityRepository debe cargarlo junto a get_public_availability y pasarlo a buildCalendarDaysFromOperatingDays(..., slotMinutes). No crear otra fuente paralela ni hardcodear 60.

El fallback demo puede seguir usando businessConfig.availability.slotMinutes.

## UX admin

- Reutilizar Configuración → Estructura, sección Negocio.
- Mostrar siempre el intervalo vigente.
- Owner/Admin pueden escoger un incremento válido y guardarlo.
- Staff conserva solo lectura.
- Explicar que el cambio define la cuadrícula visible al cliente.
- Si existen reservas/bloqueos futuros incompatibles, mostrar error específico con role=alert.
- Éxito usa role=status.
- Busy: Actualizando…
- Controles táctiles >=44px y responsive móvil.

## Límites

- No cambiar timezone, moneda ni precios en B23.
- No reescribir reservas ni bloqueos existentes.
- No aceptar business_id o actor desde browser.
- No alterar el significado de configuration_status.
- No deploy, push/commit ni migraciones remotas sin autorización.

## Validación

1. npm run typecheck
2. npm run lint
3. npm test
4. npm run validate:repo
5. npm run validate:supabase-security
6. npm run qa
7. npm run build
8. npm audit --audit-level=moderate
9. git diff --check

Ejecutar supabase/tests/platform_booking_settings.sql solo con Postgres local real (LOCAL_DB_URL + psql). Si no existe, reportar la limitación; el auditor estático no sustituye SQL E2E ni una prueba real de concurrencia.
