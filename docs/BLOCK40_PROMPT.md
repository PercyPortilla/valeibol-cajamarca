# BLOQUE 40 — Reprogramación segura de reservas confirmadas

- El cliente nunca mueve directamente una reserva `confirmed`; crea una solicitud `reschedule`.
- La UI usa disponibilidad pública real del tenant para seleccionar cancha/fecha/hora.
- Solo canchas activas del mismo tenant y mismo deporte son elegibles.
- La solicitud valida horario, granularidad, iluminación, pricing y disponibilidad antes de persistirse.
- El horario original permanece ocupado mientras la solicitud está `pending`.
- Solo puede existir una solicitud de cambio abierta por reserva, sea cancelación o reprogramación.
- OWNER/ADMIN aprueban o rechazan; STAFF solo visualiza.
- Al aprobar se revalidan horario, cancha, iluminación y pricing; si el quote cambió, se exige una nueva solicitud en vez de aplicar silenciosamente otro precio.
- El update de `reservations` activa el ledger `court_schedule_entries`; su EXCLUDE evita doble reserva bajo concurrencia.
- Si el nuevo slot ya fue ocupado, la transacción falla con `slot_unavailable` y la reserva original queda intacta.
- Pricing se serializa con el mismo advisory lock de la gestión de tarifas.
- Si existe pago histórico abierto y el nuevo total cambia, la reprogramación se bloquea; no se introduce UI de pagos.
- `admin_edit_reservation` queda limitado a `pending`; una `confirmed` no puede saltarse B40 desde la edición administrativa genérica.
- Sin commit, push, deploy ni cambios remotos sin autorización explícita.

