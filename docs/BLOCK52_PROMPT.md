# BLOQUE 52 — Respuesta del negocio en solicitudes de cambio

Continúa sobre B39–B51 cerrados. Completa la trazabilidad de las solicitudes de cancelación/reprogramación iniciadas por el cliente reutilizando `resolution_note`, que ya existe en PostgreSQL y ya forma parte del contrato de lectura de Mi cuenta.

## Problema

El backend acepta y persiste una `resolution_note` de hasta 500 caracteres al aprobar o rechazar una solicitud, pero el panel administrativo enviaba siempre `null`. El cliente solo veía “aprobada” o “rechazada” y perdía la explicación del negocio aunque el modelo ya soportaba esa información.

## Objetivo

- OWNER/ADMIN puede escribir una respuesta opcional al resolver una solicitud customer-origin.
- La respuesta se guarda atómicamente en el mismo RPC que resuelve la solicitud.
- Un retry solo es idempotente si repite la misma decisión y la misma respuesta normalizada.
- Mi cuenta muestra esa respuesta en el resultado de cancelación o reprogramación.
- El historial administrativo muestra la nota enlazándola al change request sin duplicar free-text en el ledger append-only.
- Expiración y retiro del cliente no deben presentarse como respuesta administrativa.
- No crear otra tabla, columna ni flujo paralelo.

## Backend existente reutilizado

- `reservation_change_requests.resolution_note` ya existe.
- Límite DB: 500 caracteres.
- `admin_resolve_reservation_change_request(uuid, boolean, text)` normaliza, valida y persiste la nota.
- La resolución customer-origin queda con `resolution_kind='admin_resolution'`.
- `get_my_reservation_change_requests()` ya devuelve `resolution_note` solo dentro del historial propio del usuario autenticado.

## Aplicación

- `resolveReservationChangeRequestAction` recibe una nota opcional, normaliza espacios y valida 500 caracteres antes de invocar el RPC.
- El panel muestra “Respuesta al cliente (opcional)” únicamente para solicitudes customer-origin activas que OWNER/ADMIN puede resolver.
- La UI advierte que el cliente verá esa respuesta en Mi cuenta.
- Cancelación y reprogramación reciben `resolutionNote` desde el request más reciente.
- Solo `admin_resolution` muestra “Respuesta del negocio”; `customer_expiration` y `customer_withdrawal` conservan sus mensajes propios.

## Seguridad y consistencia

- No se cambia autorización ni tenant scope: la resolución sigue pasando por el RPC autoritativo existente.
- No se permite business_id/user_id desde navegador.
- La nota y el cambio de estado se guardan dentro de la misma resolución DB.
- Si una solicitud ya quedó resuelta, una reejecución con una nota distinta devuelve conflicto en vez de simular que esa nota se guardó.
- `get_admin_reservation_audit` enlaza `reservation_change_requests` por request + business + reservation y solo muestra la nota en eventos terminales.
- No se toca lifecycle B43–B51, pagos ni estados de reserva.

## Validación

- Action deja de enviar `p_resolution_note: null` fijo.
- Nota normalizada y acotada a 500.
- UI admin captura la nota y explica su visibilidad.
- Mi cuenta muestra la respuesta en cancelación/reprogramación.
- Retry exacto misma decisión+misma nota; nota distinta no recibe ACK idempotente.
- Historial admin muestra la nota solo en el evento terminal relacionado.
- Expiración/retiro siguen diferenciados.
- Contrato SQL comprueba persistencia y lectura propia.
- TypeScript, lint, suite completa, build, validate:repo y git diff --check.

## Fuera de alcance

- No añadir notas a expiración automática o retiro del cliente.
- No cambiar propuestas business-origin B44/B45.
- No cambiar pagos.
- No push ni deploy.
