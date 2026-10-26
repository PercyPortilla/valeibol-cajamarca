# BLOQUE 43 — Consistencia del lifecycle de solicitudes de cambio

Continúa sobre B39–B42 cerrados. B43 corrige dos huecos conectados del workflow de cancelación/reprogramación sin introducir un modelo paralelo.

## Integridad administrativa

- admin_cancel_reservation() y admin_complete_reservation() bloquean primero la reserva y luego cualquier reservation_change_requests pendiente.
- Si una reserva confirmed tiene una solicitud de cancelación o reprogramación pendiente, la transición administrativa genérica devuelve reservation_change_request_pending.
- Owner/Admin deben resolver la solicitud desde el workflow B39/B40 antes de cancelar o completar por la vía genérica.
- STAFF conserva cancelación/completado ordinarios cuando no existe solicitud pendiente, pero no puede saltarse indirectamente la regla B39/B40.
- El orden de locks es reservation -> change_request, igual que creación/resolución de solicitudes, para evitar carreras y deadlocks.
- Una pending sin change request conserva la cancelación administrativa existente.

## Reintentos del cliente

- PostgreSQL ya permite una nueva solicitud cuando la anterior está approved o rejected; solo existe una solicitud pending a la vez.
- Mi cuenta deja de ocultar las acciones por el mero hecho de existir una solicitud histórica resuelta.
- Una cancelación rechazada puede volver a solicitarse mientras can_request_cancellation siga siendo verdadero.
- Una reprogramación aprobada o rechazada puede volver a solicitarse mientras la reserva continúe confirmed, futura y sin otro request pendiente.
- Si la reserva ya no cumple esas condiciones, se muestra el último estado resuelto pero no se ofrece una acción inválida.

## Seguridad y concurrencia

- No se acepta business_id, user_id ni rol desde navegador.
- La autorización administrativa sigue derivándose de phase6_admin_actor().
- La elegibilidad cliente continúa derivándose de get_my_reservations(); la UI no inventa ventanas temporales.
- Sin cambios a pricing, pagos, disponibilidad, auditoría B42 ni notificaciones B41.

## Fuera de alcance

- No añade reprogramación iniciada por el negocio; ese flujo queda como candidato posterior.
- No commit, push, deploy ni cambios remotos sin autorización explícita.

