# BLOQUE 28 — Correcciones estructurales seguras de inventario

## Objetivo

Cerrar una limitación de B20: después del alta, Owner/Admin podía editar nombre y superficie de una cancha, pero un error en slug, sede o deporte exigía SQL manual. B28 permite corregir esos errores sin reescribir historial operativo.

## Reglas de seguridad

- El tenant y rol se derivan de `auth.uid()` mediante `phase6_admin_actor()`; el cliente nunca aporta `business_id`.
- Solo `owner` y `admin` tenant pueden ejecutar las correcciones.
- El negocio debe estar `provisional`: primero se retira de publicación para evitar cambios estructurales mientras recibe reservas públicas.
- El slug de sede puede corregirse solo en modo provisional y conserva unicidad por tenant.
- Para cambiar slug, sede o deporte de una cancha, la cancha debe estar inactiva.
- Una cancha con cualquier reserva histórica no puede cambiar su estructura.
- Una cancha con cualquier bloqueo histórico no puede cambiar su estructura.
- Cambiar a otra sede exige que la sede destino pertenezca al mismo tenant y esté activa.
- Cambiar a otro deporte exige que el deporte destino esté activo.
- No se borran reservas, bloqueos, horarios, tarifas ni canchas.
- Horarios y tarifas permanecen asociados al mismo `court_id`; B28 solo corrige la clasificación estructural cuando todavía no existe historia operativa.

## RPC

### `admin_update_venue_slug(p_venue_id, p_slug)`

Corrige el slug de una sede del tenant autenticado. Serializa primero el negocio y después la sede, exige estado provisional y rechaza slugs duplicados.

### `admin_update_court_structure(p_court_id, p_venue_id, p_sport_id, p_slug)`

Corrige atómicamente slug, sede y deporte de una cancha. Exige tenant provisional, cancha inactiva y ausencia total de reservas/bloqueos históricos. Incrementa `availability_revisions` al guardar.

## UX

- `/admin/configuracion/estructura` conserva la edición normal de nombre, dirección, superficie, estado, horario y tarifas.
- Cada sede añade una sección separada `Corrección estructural` para el slug.
- Cada cancha añade `Corregir alta de la cancha` con slug, sede y deporte.
- Si el tenant está publicado, los controles quedan deshabilitados e indican que debe retirarse de publicación.
- Si la cancha está activa, indica que debe desactivarse primero.
- Si PostgreSQL detecta historia de reservas o bloqueos, muestra un error específico y no modifica nada.
- Staff continúa en solo lectura.

## Límites

- No modifica slug/moneda/timezone del negocio; B25 mantiene ese ciclo global.
- No permite “migrar” una cancha histórica a otro deporte o sede. Eso requeriría un modelo explícito de versionado histórico y queda fuera de B28.
- No hay hard delete.
- No hay deploy ni migraciones remotas en este bloque.

## Validación

1. Tests dirigidos B28.
2. `npm run typecheck`.
3. `npm run lint`.
4. `npm test`.
5. `npm run validate:repo`.
6. `npm run validate:supabase-security`.
7. `npm run qa`.
8. `npm run build`.
9. `npm audit --audit-level=moderate`.
10. `git diff --check`.
11. SQL E2E real mediante GitHub Actions antes de declarar B28 cerrado.
