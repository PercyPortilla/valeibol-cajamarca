# Prompt operativo · Bloque 5 — Sistema de reservas multi-cancha

Partir del flujo de disponibilidad/reserva existente y generalizarlo; no crear un segundo sistema.

## Objetivo

Permitir que `/reservar` funcione para cualquier negocio y cancha del catálogo, manteniendo la reserva autoritativa en servidor/Supabase.

## Requisitos

- `AvailabilityCalendar` debe aceptar `businessSlug`, cancha inicial y mapa cancha→deporte, conservando los valores actuales como defaults para Valeibol.
- `ReservationDialog` debe usar el negocio recibido, no `businessConfig.slug` hardcodeado.
- Propagar la zona horaria de la cancha para validar horarios pasados.
- La altura de red es una regla específica de vóley: obligatoria entre 180–250 cm en vóley y no aplicable (`NULL`) en fútbol/futsal/básquet.
- El API proxy y Edge Function deben aceptar `netHeightCm: number | null`, manteniendo allowlist y validación de rango cuando exista.
- La RPC `create_public_reservation_request` conserva firma, permisos e idempotencia, pero resuelve el deporte de la cancha antes de validar altura.
- No mover cálculo de precio, iluminación, disponibilidad ni total al navegador.
- Mantener solicitudes guest, WhatsApp, rate limiting y estados actuales.
- `/reservar?negocio=<slug>&cancha=<uuid>` debe cargar la agenda del negocio y seleccionar la cancha indicada.
- Sin negocio seleccionado, mostrar navegación a `/buscar`; IDs inválidos devuelven 404.
- No instalar dependencias, no hacer deploy y no cambiar la actualización de seguridad de Next.js.

## Validación

Ejecutar TypeScript, lint, tests Node, auditoría Supabase, test SQL `multi_sport_booking.sql` cuando PostgreSQL local esté disponible y build de producción. Corregir cualquier regresión antes de cerrar.
