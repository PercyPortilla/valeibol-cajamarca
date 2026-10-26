# BLOQUE 30 — Retiro seguro de solicitud pendiente por el cliente

## Objetivo

Permitir que un cliente autenticado retire desde `Mi cuenta` una solicitud de reserva que todavía está `PENDING`, siempre que sea propia, futura y no tenga un pago abierto. La operación libera la agenda sin permitir que el navegador elija usuario, negocio, estado o monto.

## Contrato de dominio

- La identidad se deriva exclusivamente de `auth.uid()`.
- `reservations.user_id` es la relación autoritativa entre la cuenta y la reserva; no se crea una tabla paralela.
- Solo una reserva propia `pending`, de origen `public_web` y con `start_at > now()` puede retirarse.
- Una reserva `confirmed` o `completed` nunca se cancela desde autoservicio; debe coordinarse con el negocio.
- Repetir el retiro de una reserva propia ya `cancelled` es idempotente.
- Un pago `reported` o `verified` bloquea el retiro autoservicio para conservar trazabilidad y obliga a coordinar con el negocio.
- Pagos históricos `rejected` o `refunded` no bloquean por sí solos el retiro.

## Concurrencia y consistencia

- `withdraw_my_pending_reservation(uuid)` toma la reserva `FOR UPDATE` antes de validar estado/pago.
- `get_my_reservations()` expone únicamente el booleano derivado `can_withdraw`; no expone filas ni estados del ledger de pagos al cliente.
- `report_my_payment()` ya toma la reserva `FOR SHARE`; por ello pago y retiro quedan serializados sobre la misma fila.
- Confirmación/cancelación administrativa también bloquea la reserva, evitando transiciones concurrentes incompatibles.
- Cambiar `pending -> cancelled` reutiliza `sync_reservation_schedule_entry()` y deja `blocks_availability=false`, liberando el horario.
- El trigger WhatsApp existente procesa el cambio de estado; además el claim robustecido descarta un `owner_new_request` todavía no enviado cuando la reserva deja de estar `pending`.

## Seguridad

- La RPC es `SECURITY DEFINER` con `search_path` fijo.
- `anon` no puede ejecutarla; únicamente `authenticated` recibe `EXECUTE`.
- No se abre DML directo sobre `reservations`, `reservation_payments` ni `court_schedule_entries`.
- La cuenta global debe seguir activa.
- Una reserva ajena se comporta como inexistente para el usuario.

## UX

- `Mi cuenta` muestra `Retirar solicitud` únicamente cuando el servidor devuelve `can_withdraw=true`, por lo que pagos abiertos, horarios iniciados y orígenes no públicos no generan una acción engañosa.
- La acción requiere una confirmación explícita antes de modificar el estado.
- El texto explica que el horario será liberado y que confirmaciones/pagos abiertos requieren coordinación con el negocio.
- Errores de negocio tienen mensajes específicos; errores se anuncian con `role="alert"` y éxito con `role="status"`.
- Los botones mantienen un target mínimo de 44 px y la confirmación pasa a una columna en móvil.

## Archivos principales

- `supabase/migrations/20261025060000_block30_customer_pending_withdrawal.sql`
- `supabase/tests/platform_customer_withdrawal.sql`
- `lib/data/supabase/database.types.ts`
- `components/account/CustomerReservationActions.tsx`
- `app/mi-cuenta/page.tsx`
- `app/styles/globals-5.css`
- `tests/platform-customer-withdrawal.test.ts`

## Límites

- No permite autoservicio para reservas confirmadas.
- No implementa reembolsos ni modifica el ledger de pagos.
- No crea una nueva clase de estado de reserva.
- No borra reservas: el historial conserva `cancelled`.
- No hay push, deploy ni migración remota en este bloque.

## Validación

1. Test dirigido B30.
2. `npm run typecheck`.
3. `npm run lint`.
4. `npm test`.
5. `npm run validate:repo`.
6. `npm run validate:supabase-security`.
7. `npm run qa`.
8. `npm run build`.
9. `npm audit --audit-level=moderate`.
10. `git diff --check`.
11. SQL E2E local/GitHub Actions con `platform_customer_withdrawal.sql`.
