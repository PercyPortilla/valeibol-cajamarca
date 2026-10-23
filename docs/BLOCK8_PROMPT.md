# Prompt operativo · Bloque 8 — Pagos manuales

Implementar pagos manuales trazables sin conectar una pasarela ni ejecutar dinero real.

## Modelo

Crear métodos por negocio: Yape, Plin, efectivo y transferencia bancaria. Deben iniciar desactivados; nunca inventar números o cuentas. El propietario/admin configura destino e instrucciones reales.

Crear un ledger `reservation_payments` con estados `reported`, `verified`, `rejected`, `refunded`. “reported” significa únicamente que el cliente declara haber pagado; “verified” requiere acción administrativa explícita.

## Seguridad

- Cliente autenticado solo reporta pagos de reservas cuyo `user_id = auth.uid()`.
- El cliente nunca envía monto, moneda o negocio: se derivan de la reserva y su negocio.
- Tablas de pago sin acceso directo anon/authenticated; usar RPCs mínimas.
- Owner/admin pueden configurar métodos y revisar pagos; staff no verifica/rechaza.
- El modo local no debe simular pagos financieros.

## UX

- Mostrar métodos activos al completar una solicitud de reserva.
- En `/mi-cuenta`, permitir reportar pago manual y mostrar estado del reporte.
- Crear `/admin/pagos` para configurar métodos y verificar/rechazar reportes.
- Añadir Pagos a navegación admin y portal propietario.

No integrar Stripe/Culqi/Mercado Pago ni desplegar. Validar TypeScript, lint, tests, seguridad y build.
