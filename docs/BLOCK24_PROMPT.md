# Prompt operativo · Bloque 24 — Readiness y publicación del tenant

Trabaja sobre B20–B23 ya validados. B24 convierte `businesses.configuration_status` en el lifecycle explícito de publicación del negocio y mantiene `businesses.is_active` reservado para suspensión global de plataforma.

## Objetivo

- Un tenant `provisional` sigue siendo administrable por su equipo, pero no aparece en el marketplace ni acepta nuevas reservas públicas.
- Un tenant `confirmed` puede ser descubierto y reservado públicamente.
- Owner/Admin tenant pueden publicar o retirar publicación desde `Configuración → Negocio, sedes y canchas`; Staff conserva solo lectura.
- El navegador nunca envía `business_id` ni actor autoritativo.

## Readiness DB-authoritativo

Antes de publicar, PostgreSQL debe confirmar:

1. al menos una sede activa;
2. al menos una cancha activa;
3. todas las canchas activas pertenecen a una sede activa y a un deporte activo;
4. cada cancha activa tiene siete weekdays efectivos y confirmados para la fecha local actual del negocio;
5. cada cancha activa tiene al menos un día abierto;
6. cada cancha activa tiene las dos modalidades de tarifa activas, efectivas y confirmadas.

No usar contenido cosmético, galería o reseñas como requisito de publicación.

## RPCs

### `get_admin_publication_readiness()`

- `SECURITY DEFINER`, `search_path` fijo.
- Deriva tenant desde `phase6_admin_actor()`.
- Permite lectura a owner/admin/staff activos.
- Devuelve estado actual y flags sanitizados de readiness, sin PII ni `owner_user_id`.

### `admin_set_business_configuration_status(p_status)`

- `SECURITY DEFINER`, `search_path` fijo.
- Solo owner/admin tenant.
- No recibe `business_id`.
- Bloquea primero `businesses FOR UPDATE`, compartiendo la misma frontera de serialización de B22/B23.
- Para `confirmed`, recomputa readiness dentro de la transacción y rechaza si falta sede, cancha o preparación operativa.
- Para `provisional`, no cancela ni reescribe reservas existentes; solo detiene nuevas entradas públicas.
- Incrementa `availability_revisions` una sola vez por transición efectiva.

## Gating público

Exigir `businesses.configuration_status='confirmed'` además de `is_active` en:

- catálogo público;
- configuración pública del negocio;
- contexto público de reserva;
- disponibilidad pública;
- pricing público por fecha.
- contenido público del negocio;
- reseñas públicas del negocio.

Además, toda inserción nueva con `source='public_web'` debe ser rechazada si el negocio no está activo y publicado. El guard es `BEFORE INSERT` y no bloquea altas internas del panel, ni editar/cancelar/completar reservas existentes después de retirar publicación.

`get_public_payment_methods` se mantiene disponible: una reserva ya existente puede necesitar instrucciones de pago incluso después de retirar el negocio de publicación. Historial autenticado, reporte de pago, reseñas y favoritos existentes tampoco se destruyen.

## Compatibilidad

La migración normaliza a `confirmed` los horarios efectivos provisionales de tenants activos que ya estaban sirviendo disponibilidad pública, sin cambiar horas ni tarifas. Después puede confirmar una sola vez los negocios que satisfagan el mismo readiness, evitando sacar del marketplace inventario que ya estaba públicamente en uso antes de B24.

La desactivación de canchas queda serializada con lock `business → court`. Un tenant publicado no puede perder su última cancha operativa lista: primero debe retirarse de publicación o dejar otra cancha preparada.

## UX

- Reutilizar la sección de estructura existente.
- Mostrar `En preparación` / `Publicado` mediante el badge ya existente.
- Checklist visible de sede activa, cancha activa y canchas operativas listas.
- Owner/Admin ven `Publicar negocio` o `Retirar de publicación`.
- `Publicar negocio` queda deshabilitado si el readiness leído por backend no está completo; la RPC vuelve a validar igualmente.
- Retirar publicación exige confirmación clara: deja de aparecer y de aceptar nuevas reservas, pero conserva las existentes.
- Busy: `Publicando…` / `Retirando…`.
- Success con `role=status`; error con `role=alert`.
- Targets táctiles >=44 px y responsive móvil.

## Límites

- No convertir `is_active` en control tenant.
- No cancelar reservas al retirar publicación.
- No exponer tenant cross-business.
- No permitir Staff mutar publicación.
- No crear otra página o sistema paralelo.
- No hacer commit, push, deploy ni migraciones remotas sin autorización explícita.

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

Ejecutar `supabase/tests/platform_readiness.sql` solo si existe Postgres local válido (`LOCAL_DB_URL` + `psql`). Si no existe, reportar explícitamente que SQL E2E no fue ejecutado.

\n