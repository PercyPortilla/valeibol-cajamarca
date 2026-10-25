# Prompt operativo · Bloque 25 — Configuración estructural global del tenant

Trabaja sobre B20–B24 ya validados. B20 reservó `slug`, `currency` y `timezone` al ciclo global, pero solo implementó su valor inicial durante el alta. B25 permite corregir esos tres datos desde `/admin-global` sin SQL manual y sin convertir al ADMIN global en operador del tenant.

## Alcance

- ADMIN global puede corregir únicamente slug público, moneda ISO de tres letras y timezone IANA.
- Nombre, ciudad, país, dirección y teléfono siguen perteneciendo al panel tenant.
- Owner principal sigue gestionándose por B21, nunca desde esta acción.
- No exponer `owner_user_id`, clientes, reservas, pagos ni otra PII tenant en el listado global.

## Seguridad

`platform_admin_update_business_core(business_id, slug, currency, timezone)`:

1. exige `is_platform_admin()`;
2. valida UUID implícito, slug seguro, moneda ISO-like de tres letras y timezone existente en `pg_timezone_names`;
3. bloquea `businesses FOR UPDATE`;
4. exige `configuration_status='provisional'`: el propietario debe retirar publicación antes de cambiar identidad estructural;
5. slug debe seguir siendo único;
6. moneda no puede cambiar si existe cualquier historial de reservas, porque los importes históricos usan la moneda del negocio;
7. timezone no puede cambiar si existen reservas o bloqueos, porque reinterpretaría tiempos locales históricos;
8. no modifica precios, horarios, reservas ni bloqueos;
9. incrementa `availability_revisions` cuando existe una transición efectiva.

El navegador puede enviar `business_id` en esta superficie porque el actor es un ADMIN global cross-tenant explícito; la RPC vuelve a autorizar la sesión y no usa el ID como prueba de permiso.

## Listado global

`get_platform_admin_businesses_page` continúa omitiendo owner y PII, y añade solamente:

- `configuration_status`;
- `currency`;
- `timezone`.

## UX

- Mostrar moneda, timezone y estado Publicado/En preparación por negocio.
- `Editar configuración` solo está habilitado cuando el tenant está `provisional`.
- Si está publicado, explicar que el propietario debe retirarlo de publicación primero.
- Confirmar antes de guardar y advertir que no existe conversión automática de importes ni horarios.
- Mensajes específicos para slug duplicado, timezone inválido, historial monetario y temporal.
- Busy `Guardando…`, feedback accesible y targets >=44 px.
- Responsive de una columna en móvil.

## Límites

- No editar publication status desde ADMIN global.
- No modificar `is_active` con esta RPC; suspensión sigue separada.
- No hacer conversiones monetarias ni transformaciones horarias.
- No permitir cambio de moneda/timezone cuando destruiría la semántica histórica.
- No commit, push, deploy ni migración remota sin autorización explícita.

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

Ejecutar `supabase/tests/platform_business_core_settings.sql` únicamente si existe Postgres local real. Si no existe, documentar la limitación sin simular SQL E2E.
