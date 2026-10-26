# BLOQUE 31 — Contacto cliente → negocio sin callejones sin salida

## Objetivo

Cerrar el flujo de coordinación que B30 deja deliberadamente fuera del autoservicio. `Mi cuenta` ya indica que una reserva confirmada, una solicitud iniciada o una solicitud con pago abierto debe coordinarse directamente con el negocio; B31 convierte esa instrucción en una acción real cuando el negocio publicó un teléfono válido.

## Contrato

- `get_my_reservations()` añade únicamente `business_phone` del negocio asociado a la reserva propia.
- El historial sigue derivando identidad exclusivamente de `auth.uid()` y exige `user_accounts.is_active`.
- El contacto de una reserva propia no depende del `configuration_status` actual del tenant: retirar una publicación no elimina la obligación de coordinar reservas ya existentes.
- La ficha pública genérica sí conserva el gating público existente y lee el teléfono mediante `get_public_business_config(slug)`.
- Los teléfonos se normalizan a E.164 antes de construir un enlace `wa.me`; un valor inválido nunca genera CTA.

## Mi cuenta

- Se muestra `Contactar por WhatsApp` para reservas `confirmed` y solicitudes `pending` que ya no pueden retirarse por autoservicio.
- Una `pending` todavía retirable mantiene como acción principal `Retirar solicitud`; B31 no duplica ni compite con ese flujo.
- Reservas `cancelled` y `completed` no muestran CTA operativo de coordinación.
- Si el negocio no tiene teléfono válido, se muestra un mensaje neutral y no se inventa un enlace.
- El mensaje prellenado incluye solo contexto operativo de la reserva (cancha, fecha y hora).

## Ficha pública genérica

- `/complejo/[slug]` muestra contacto por WhatsApp cuando `get_public_business_config` devuelve un teléfono válido.
- Un tenant sin teléfono muestra un estado neutral.
- La landing histórica de Valeibol conserva su flujo especial existente.

## Seguridad y privacidad

- No se abre DML ni lectura directa de tablas al navegador.
- No se crea una RPC de escritura ni un sistema paralelo de contactos.
- `business_phone` pertenece al negocio, no al cliente; no expone PII de otros usuarios.
- El historial propio continúa cerrado a `anon`.

## Archivos principales

- `supabase/migrations/20261025070000_block31_customer_business_contact.sql`
- `supabase/tests/platform_customer_contact.sql`
- `lib/data/publicBusinessContactService.ts`
- `lib/data/supabase/database.types.ts`
- `app/mi-cuenta/page.tsx`
- `app/complejo/[slug]/page.tsx`
- `app/styles/globals-5.css`
- `tests/platform-customer-contact.test.ts`

## Fuera de alcance

- No habilita cancelación autoservicio de reservas confirmadas.
- No reintroduce pagos en la UI.
- No crea una nueva plantilla WhatsApp transaccional para el owner; ese posible aviso operativo queda separado porque requiere configuración/plantilla Meta adicional.
- No hay push ni deploy en este bloque.

## Validación

1. Tests focales B31 + B30 + cuenta cliente + complejo.
2. `npm run typecheck`.
3. `npm run lint`.
4. `npm test`.
5. `npm run validate:repo`.
6. `npm run validate:supabase-security`.
7. `npm run qa`.
8. `npm run build`.
9. `npm audit --audit-level=moderate`.
10. `git diff --check`.
11. SQL E2E local/CI con `platform_customer_contact.sql` cuando Docker esté disponible.
