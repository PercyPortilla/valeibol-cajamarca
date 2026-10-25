# Prompt operativo · Bloque 22 — Horarios regulares versionados por cancha

Trabaja sobre B20–B21 ya validados. B22 completa el inventario operativo permitiendo que Owner/Admin programe cambios del horario semanal regular sin editar SQL y sin reescribir la historia usada por reservas, disponibilidad o métricas.

## Principios

- `operating_hours` es una tabla versionada: `effective_from` / `effective_until` forman parte del modelo y deben conservarse.
- Un cambio regular nunca modifica una fila histórica vigente en el pasado.
- Los cierres puntuales del mismo día pertenecen a `schedule_blocks`; B22 programa horario regular desde mañana o una fecha posterior.
- El tenant y el rol se derivan de `auth.uid()` mediante `phase6_admin_actor()`. El navegador no envía `business_id` ni actor.
- Solo `owner` y `admin` tenant pueden programar horarios. `staff` mantiene lectura de la estructura y operación de agenda según sus permisos existentes.

## RPC

Implementar `admin_schedule_court_operating_hours(court,hours,effective_from)` como `SECURITY DEFINER`, `search_path` fijo y ejecución para `authenticated` únicamente.

1. Validar exactamente siete weekdays distintos, forma abierto/cerrado y horas válidas antes de hacer casts tipados desde JSON; keys ausentes o tipos inválidos deben terminar en `invalid_weekly_hours`.
2. Exigir al menos un día abierto; para retirar una cancha se usa su estado activo/inactivo.
3. Exigir `effective_from > business_today` en la zona horaria real del tenant.
4. Bloquear primero el `business` `FOR UPDATE` y después la cancha `FOR UPDATE`. Booking público y `phase6_resolve_window` siguen `business → court` con `FOR SHARE`. El business es además la frontera compartida con B23 para que horario e incremento nunca se validen contra snapshots antiguos cruzados.
5. No bloquear filas de reservas dentro de B22: `admin_edit_reservation` ya usa el orden reserva → cancha y el orden inverso introduciría riesgo de deadlock.
6. Rechazar el cambio si una reserva futura `pending`/`confirmed` gobernada por esa nueva vigencia quedaría cerrada, fuera de rango o desalineada del incremento de reserva leído de la fila `business` ya bloqueada. La alineación se compara en tiempo local de pared, igual que `phase6_resolve_window`, para no introducir falsos conflictos en zonas con DST.
7. Aplicar el mismo guard a `schedule_blocks` futuros activos.
8. Si ya existe una versión exactamente en esa fecha futura, corregir esa versión conservando su rango.
9. Si es una versión nueva, cerrar únicamente la versión anterior que la solapa e insertar la nueva hasta el día anterior a la siguiente versión programada. Nunca borrar versiones posteriores.
10. Incrementar `availability_revisions` una sola vez para refrescar calendarios públicos abiertos.

## Lectura y UX

- Reutilizar `Configuración → Negocio, sedes y canchas`; no crear un subsistema paralelo.
- `get_admin_business_structure()` conserva su firma y añade `operatingHours` dentro del JSON de cada cancha.
- Cada cancha muestra el horario vigente, fechas futuras ya programadas y un editor semanal con `Vigente desde`.
- El mínimo de fecha es mañana según la zona horaria del negocio.
- Mostrar busy `Programando…`, éxito con `role=status` y errores con `role=alert`.
- Un `router.refresh()` provocado por otra cancha/sede no debe descartar una semana que el usuario está editando; conservar el borrador local mientras esté `dirty`.
- Explicar claramente conflictos con reservas o bloqueos futuros y distinguir horario regular de cierres puntuales.
- Mantener controles táctiles >=44px y responsive móvil.

## Límites

- No modificar precios en este bloque.
- No reescribir reservas existentes ni sus importes.
- No aceptar `business_id`, timezone ni actor desde el navegador.
- No borrar historia ni versiones futuras de horarios.
- No hacer commit, push, migraciones remotas ni deploy sin autorización explícita.

## Validación

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run validate:repo`
5. `npm run validate:supabase-security`
6. `npm run qa`
7. `npm run build`
8. `npm audit --audit-level=moderate`
9. `git diff --check`

Ejecutar `supabase/tests/platform_operating_hours.sql` y los demás SQL tests solo si existe un Postgres local válido (`LOCAL_DB_URL` + `psql`). Si no existe, reportar explícitamente esa limitación; los validadores estáticos no sustituyen SQL E2E.
