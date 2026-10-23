# Prompt operativo · Bloque 5 — Sistema de reservas multi-cancha

Continúa sobre el proyecto existente y considera los Bloques 1–4 cerrados. Implementa únicamente el **BLOQUE 5: sistema de reservas multi-cancha y multi-deporte**, reutilizando el flujo de disponibilidad/reserva actual y sin crear un sistema paralelo.

## Objetivo

Hacer que `/reservar` funcione correctamente para cualquier negocio y cancha seleccionados desde el catálogo global, manteniendo la lógica autoritativa de disponibilidad, precio, iluminación, total e idempotencia en servidor/Supabase.

## Requisitos operativos

- Parametriza completamente el flujo con `businessSlug`, `initialCourtId` y la relación cancha→deporte; no permitas que el componente global vuelva silenciosamente a `businessConfig.slug` o a `voley` cuando falte contexto.
- Conserva compatibilidad con la landing histórica de Valeibol pasando explícitamente su negocio, cancha inicial y deporte desde el call site legacy.
- `/reservar?negocio=<slug>&cancha=<uuid>` debe resolver el catálogo del negocio, validar que la cancha pertenezca a ese negocio, seleccionar esa cancha y pasar el `businessSlug` canónico del catálogo al calendario.
- Si cambia `businessSlug` o `initialCourtId`, sincroniza el estado del calendario y cierra cualquier selección de reserva anterior para no conservar una cancha de otra navegación.
- `ReservationDialog` debe usar siempre el negocio y la cancha recibidos. La zona horaria debe provenir de la cancha/agenda consultada para validar horarios pasados.
- La altura de red es una regla exclusiva de vóley: debe ser obligatoria y estar entre 180–250 cm para vóley; para fútbol, futsal y básquet debe viajar como `NULL` y no debe mostrarse el selector de altura.
- El contrato TypeScript, proxy `/api/public/reservation-requests`, repositorio Supabase y Edge Function deben aceptar y propagar `netHeightCm: number | null`, validando rango únicamente cuando el valor no sea `NULL`.
- La RPC `create_public_reservation_request` debe resolver el deporte real de la cancha antes de validar altura, conservar su firma pública actual, permisos, idempotencia, rate limiting, guest booking y reglas de concurrencia.
- Si falta el mapeo cancha→deporte, no inventes `voley`: evita habilitar la solicitud hasta tener contexto válido.
- Sin negocio seleccionado, `/reservar` debe dirigir al usuario a `/buscar`; negocio o cancha inválidos deben terminar en 404.
- No instales dependencias, no hagas deploy, no actualices Next.js y no mezcles cambios ajenos al bloque.

## Validación obligatoria

Ejecuta `git diff --check`, `npm run typecheck`, `npm run lint`, tests focalizados del booking, `npm test`, `npm run qa`, `npm run validate:repo` y `npm run build`. Ejecuta `supabase/tests/multi_sport_booking.sql` cuando exista PostgreSQL/Supabase local disponible. Si la CLI o `psql` no existen en el entorno, repórtalo como limitación externa y no simules un PASS. Corrige cualquier regresión causada por el bloque antes de cerrarlo.
