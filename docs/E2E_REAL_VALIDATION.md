# Valeibol · validación E2E/concurrencia real

Fecha: 2026-10-14

Proyecto Supabase real: `tuwkvkiurykecwqklvqe` (`sa-east-1`).

La prueba se ejecutó sobre un negocio, cancha y owner temporales aislados. Al finalizar se eliminaron todos los datos E2E. No se modificaron reservas del seed de Valeibol.

## Matriz real

| Escenario | Resultado real |
| --- | --- |
| pública vs pública, mismo intervalo | PASS · 1 ganador, 1 `slot_unavailable` |
| pública vs manual | PASS · 1 ganador, 1 `slot_unavailable` |
| manual vs manual | PASS · 1 ganador, 1 `slot_unavailable` |
| reserva vs bloqueo | PASS · 1 ganador, 1 `slot_unavailable` |
| edición vs creación sobre el mismo intervalo | PASS · 1 ganador, 1 `slot_unavailable`; ledger final = 1 |
| confirmación vs cancelación simultánea | PASS · transacciones serializadas con `FOR UPDATE`; final `cancelled`, ledger bloqueante = 0 |
| pricing vs pricing, misma vigencia | PASS · 1 regla ganadora, 1 `pricing_range_conflict`; reglas finales = 1 |
| dos solicitudes simultáneas con mismo request token | PASS · ambas devuelven el mismo reservation id; reservas finales = 1 |

## Controles adicionales ya cubiertos por SQL real

Las suites SQL Phase 3–8 y hardening pasaron 8/8 sobre el mismo proyecto real e incluyen:

- pricing resuelto server-side;
- PII no expuesta por RPC pública;
- RLS y grants;
- fechas pasadas;
- días cerrados;
- fuera de horario;
- incrementos de sesión;
- solapamientos parciales/totales;
- contigüidad permitida;
- staff sin permisos de pricing;
- confirm/cancel idempotentes;
- manual pricing;
- block/unblock;
- historial y métricas;
- WhatsApp outbox privado.

## Alcance

Esta evidencia valida la concurrencia y el flujo autoritativo directamente contra PostgreSQL/Supabase real.

El smoke HTTP de la ruta Next.js `/api/public/reservation-requests` se considera parte del Bloque 6 de producción porque requiere una credencial server-side de Supabase que el conector actual no expone.
