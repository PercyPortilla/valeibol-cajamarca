# BLOQUE 39 — Solicitud de cancelación de reservas confirmadas

- Cliente autenticado puede solicitar cancelación solo de su reserva `confirmed` futura.
- La solicitud no cambia directamente `reservations.status`.
- `reservation_change_requests` conserva lifecycle `pending/approved/rejected` y auditoría.
- OWNER/ADMIN del tenant resuelven; STAFF solo visualiza en este flujo.
- Aprobar bloquea request + reservation y cambia la reserva a `cancelled`; rechazar conserva `confirmed`.
- El orden de locks es `reservation -> change_request`, igual que el flujo cliente, para evitar deadlocks.
- `get_my_reservations()` deriva `can_request_cancellation` en servidor; el cliente no decide la ventana con reloj local.
- La resolución administrativa usa server action y el patrón de autorización existente; STAFF no recibe `resolve_change_request`.
- Identidad cliente se deriva de `auth.uid()`; negocio/rol admin se derivan de `phase6_admin_actor()`.
- No se aceptan `business_id` ni `user_id` autoritativos desde navegador.
- B30 continúa siendo el retiro directo de `pending`.
- Sin pagos, reprogramación, multi-negocio, commit, push, deploy ni cambios remotos.

