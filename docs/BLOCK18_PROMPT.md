# Prompt operativo · Bloque 18 — Favoritos y reputación verificada

Trabaja sobre B14–B17 ya validados. Este bloque añade engagement real sin inventar popularidad: favoritos privados de cuenta y reseñas únicamente vinculadas a reservas verificables.

## Modelo

- `business_favorites`: PK `(user_id,business_id)`, ambas FK existentes; estado privado de cada cuenta.
- `business_reviews`: una reseña por `reservation_id`, `user_id` y `business_id` derivados por servidor, rating 1–5, comentario opcional de máximo 1000 caracteres y estado de moderación.
- Estados de reseña: `pending`, `published`, `rejected`, `hidden`.
- Ningún cliente puede enviar `user_id` ni `business_id` para crear una reseña.
- Tablas con RLS y sin DML directo para `anon`/`authenticated`; acceso de aplicación exclusivamente por RPCs con `SECURITY DEFINER` y `search_path` fijo.

## Reserva completada

- El flujo anterior no tenía una transición soportada a `completed`; B18 debe cerrarla en vez de relajar la verificación de reseñas.
- `admin_complete_reservation`: únicamente `confirmed → completed`, solo después de `end_at <= now()`, sobre el negocio del actor administrativo y con lock de la fila.
- La operación es idempotente para una reserva ya `completed`.
- Owner/admin/staff pueden marcar completada una reserva finalizada; la DB sigue siendo autoritativa.

## Favoritos

- `get_my_favorite_business_ids()` y `set_business_favorite()` derivan cuenta desde `auth.uid()`.
- Agregar favorito exige negocio activo; quitarlo sigue permitido aunque el negocio luego quede inactivo.
- No publicar `favorite_count` como reputación.
- Cards y ficha usan una isla cliente pequeña. Todas las cards comparten caché de favoritos para evitar una RPC por card.
- Usuario anónimo que intenta guardar se dirige a `/mi-cuenta`; no aceptar redirects arbitrarios.

## Reseñas

- `submit_verified_business_review` exige `reservation.user_id = auth.uid()` y `status='completed'`.
- Una sola reseña por reserva; duplicados concurrentes fallan de forma segura.
- La reseña nace `pending`; el cliente no puede editar/borrar después de enviarla.
- `/mi-cuenta` carga historial, favoritos y reservas reseñables en llamadas acotadas, nunca una consulta por reserva.

## Moderación y reputación

- Solo el ADMIN global puede publicar, rechazar u ocultar reseñas; un negocio no modera su propia puntuación.
- Solo `published` entra al promedio y conteo público.
- El catálogo existente se amplía con `rating_average` nullable y `review_count`; usar CTE agregado por negocio, sin N+1 ni tabla de agregados paralela.
- `get_public_business_reviews` expone solo rating, fecha, cancha y deporte. El comentario libre se conserva únicamente para su autor y el ADMIN global porque podría contener PII incluso después de moderación humana.
- Nunca exponer públicamente `user_id`, reservation id, cliente, email, teléfono ni comentario libre.
- JSON-LD puede emitir `AggregateRating` únicamente cuando `review_count > 0` y `rating_average` proviene de reviews `published`.

## UX y accesibilidad

- Favorito >=44×44, `aria-pressed` y label Guardar/Quitar.
- Rating visible solo si hay reseñas; con 0, mostrar texto neutral y nunca `0.0`.
- Formulario de review con `fieldset/legend`, opciones 1–5 con hit-area >=44, comentario opcional y estado live.
- Valeibol y complejos genéricos deben mostrar reputación/reseñas con el mismo origen de datos.
- Panel global incluye moderación de pendientes y publicadas recientes sin PII.

## Seguridad operacional

- B15 y B18 son migraciones locales aún no aplicadas al remoto al cierre de este bloque.
- Antes de cualquier futuro `supabase db push`, auditar/reconciliar el historial remoto/local heredado de B13; no reejecutar migraciones antiguas a ciegas.
- No hacer commit, push, migraciones remotas ni deploy sin autorización explícita posterior.

## Validación obligatoria

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run validate:repo`
5. `npm run validate:supabase-security`
6. `npm run qa`
7. `npm run build`
8. `git diff --check`
9. Revisar visualmente cards, `/mi-cuenta`, ficha Valeibol/complejo y panel global en desktop/móvil.
