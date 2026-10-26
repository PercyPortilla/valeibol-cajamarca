# BLOQUE 41 — Centro de notificaciones y actividad de reservas

Continúa sobre B20–B40 cerrados. B41 crea un centro de notificaciones interno para cliente y operación tenant, conectado a los eventos autoritativos existentes y sin depender de WhatsApp.

## Eventos

- Cliente: reserva confirmada.
- Admin tenant: nueva solicitud de reserva web pendiente.
- Cliente: cancelación solicitada, aprobada o rechazada.
- Cliente: reprogramación solicitada, aprobada o rechazada.
- Admin tenant: nueva solicitud de cancelación.
- Admin tenant: nueva solicitud de reprogramación.

## Datos y seguridad

- `app_notifications` es una proyección inmutable de actividad: guarda únicamente referencias + tipo de evento; nunca decide el estado real de una reserva y no duplica nombres, teléfonos ni texto libre de cliente.
- `app_notification_reads` guarda estado leído por `(notification_id,user_id)` para que cada operador tenga lectura independiente.
- Ambas tablas tienen RLS y no permiten DML/SELECT directo a `anon` ni `authenticated`.
- Cliente deriva identidad exclusivamente desde `auth.uid()`.
- Admin deriva negocio/usuario mediante `phase6_admin_actor()` y queda limitado al tenant actualmente autorizado/scoped.
- Las RPC de marcar leído no aceptan `user_id` ni `business_id`.
- Los triggers usan índices únicos y `ON CONFLICT DO NOTHING` para idempotencia.
- Las funciones internas de trigger no conceden `EXECUTE` a roles de aplicación.
- La proyección se escribe en la misma transacción que el evento fuente y no silencia errores inesperados; así no existen estados de negocio confirmados con una notificación que se perdió silenciosamente.
- FKs compuestas `(source_id,business_id)` impiden que una notificación privilegiada quede ligada accidentalmente a otro tenant.
- El trigger de reservas escucha también cambios de `user_id`, por lo que una reserva confirmada reclamada después mediante B37 puede generar su notificación para el nuevo titular.
- Si B37 vincula una reserva que ya estaba confirmada, la notificación usa el momento del claim como `created_at`; no reutiliza el `status_changed_at` histórico y por tanto no puede quedar enterrada fuera del límite visible por una fecha antigua.
- B41 no consulta ni escribe `whatsapp_outbox`.

## UX

- `Mi cuenta` muestra `Actividad de tus reservas`, contador de no leídas, estado Nueva/Leída y acciones individual/todas.
- `/admin/notificaciones` muestra solicitudes operativas del tenant y enlaza a Reservas.
- Navegación administrativa muestra contador de no leídas.
- STAFF puede leer actividad del tenant; la autorización para resolver B39/B40 continúa separada.
- El ADMIN global solo ve notificaciones cuando entra al scope explícito de un tenant.

## Compatibilidad

- B39/B40 conservan sus contratos y triggers; B41 escucha sus INSERT/UPDATE autoritativos.
- WhatsApp sigue funcionando de forma independiente.
- B41 usa un cutover limpio: no backfillea actividad histórica como notificaciones nuevas. Así evita alertas antiguas y no inventa timestamps de transiciones previas.
- Sin pagos visibles, email, push externo, commit, push, deploy ni cambios remotos.

## Validación

- `git diff --check`
- `npm run typecheck`
- `npm run lint`
- tests focales B41 + B39/B40 + customer-account + admin
- `npm test`
- `npm run validate:supabase-security`
- `npm run qa`
- `npm run validate:repo`
- `npm run build`
- `npm audit --audit-level=moderate`

