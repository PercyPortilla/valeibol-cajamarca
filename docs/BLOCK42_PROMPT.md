# BLOQUE 42 — Historial y auditoría completa de reservas

Continúa sobre B20–B41 cerrados. B42 incorpora un historial append-only para cambios operativos de reservas y solicitudes B39–B40.

## Eventos auditados

- creación de reserva;
- confirmación, cancelación y completado;
- reprogramación de cancha/horario;
- cambio de modalidad, altura, tarifa o valor cuando no forma parte de una reprogramación;
- vinculación B37 de una reserva a una cuenta;
- cambio de customer asociado sin copiar sus datos personales;
- archivado y restauración administrativa;
- solicitud/aprobación/rechazo de cancelación;
- solicitud/aprobación/rechazo de reprogramación.

## Privacidad

- El log no duplica nombre, teléfono, email, motivo libre ni notas internas del cliente.
- `actor_user_id` queda privado en la tabla y no se devuelve al navegador.
- UI/RPC expone únicamente categoría estable de actor: Cliente, Propietario, Administrador, Staff, Administrador global o Sistema.
- Para identidad categórica se prioriza ADMIN global → rol tenant → cliente. Una cuenta operativa no se etiqueta como Cliente solo por tener una reserva vinculada.

## Seguridad y multi-tenant

- `reservation_audit_events` tiene RLS y cero acceso directo para `anon/authenticated`.
- Escritura únicamente por triggers internos SECURITY DEFINER sin EXECUTE para roles de aplicación.
- FKs compuestas ligan cada evento a la reserva/change request del mismo `business_id`.
- Las FKs usan cascada exclusivamente para conservar el contrato existente de eliminación completa del tenant. Mientras el negocio existe, el guard append-only bloquea UPDATE/DELETE del historial y también impide borrar aisladamente una fuente auditada.
- `get_admin_reservation_audit()` deriva actor/tenant desde `phase6_admin_actor()` y no acepta `business_id`.
- ADMIN global solo puede consultar una reserva del tenant actualmente seleccionado mediante el scope B33.
- No hay RPC de update/delete del historial.
- Un trigger `BEFORE UPDATE OR DELETE` rechaza incluso mutaciones privilegiadas accidentales del historial mientras el tenant existe. La única excepción es la cascada de eliminación completa del negocio.
- STAFF conserva lectura del historial porque ya opera reservas/agenda; no puede modificar el log. OWNER/ADMIN y ADMIN global scoped comparten la misma lectura tenant-scoped.

## UX

- Cada tarjeta de `/admin/reservas` incluye `Ver historial`.
- Nueva ruta `/admin/reservas/[id]/historial`.
- Muestra actor categórico, fecha del evento, estado anterior/nuevo y comparación ANTES/DESPUÉS para cancha/horario.
- Modalidad, altura y valor muestran transición cuando cambian.
- La tarifa horaria también muestra valor anterior → nuevo cuando cambia.
- Los eventos de una misma transacción comparten `transaction_id` y una secuencia determinista; la UI los agrupa como una sola operación.
- Una resolución B39/B40 registra el lifecycle de la solicitud (`pending → approved/rejected`) y no fabrica un segundo “antes/después” de la reserva. El cambio real de reserva se registra por el trigger de `reservations`.
- Usa timezone y moneda reales del tenant.

## Cutover

- B42 no inventa cambios históricos anteriores a su instalación.
- Reservas existentes empiezan a acumular auditoría desde el primer cambio posterior a B42.

## Fuera de alcance

- No editar/eliminar eventos.
- No exponer PII de actores o clientes.
- No cambiar B39/B40 ni la lógica de disponibilidad/precios.
- No commit, push, deploy ni cambios remotos sin autorización explícita.

