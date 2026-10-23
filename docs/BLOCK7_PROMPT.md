# Prompt operativo · Bloque 7 — Usuarios y clientes

Añadir identidad de cliente e historial personal sin romper el modelo guest existente.

## Reglas de seguridad

- El navegador nunca envía ni controla `userId` para una reserva.
- El API de Next deriva el usuario autenticado desde la sesión Supabase server-side.
- El Edge Function recibe esa identidad únicamente después de validar el secreto server-to-server.
- `link_public_reservation_user` solo puede ejecutarlo `service_role`.
- `get_my_reservations()` no acepta parámetros de identidad y filtra exclusivamente por `auth.uid()`.
- Reservas guest siguen siendo válidas con `reservations.user_id = NULL`.
- No exponer teléfono, notas internas ni PII administrativa en el historial del cliente.

## UX

Crear `/mi-cuenta` con inicio de sesión y registro por correo/contraseña usando Supabase Auth existente. El callback de email debe aceptar de forma segura `/mi-cuenta`, sin open redirects.

Usuario anónimo: mostrar acceso/registro. Usuario autenticado: mostrar correo, logout e historial de reservas vinculadas; si está vacío, ofrecer volver a `/buscar`.

Agregar “Mi cuenta” a navegación global. No reutilizar el login admin como interfaz cliente, aunque ambos compartan Supabase Auth.

No instalar dependencias, no desplegar y no modificar Next.js. Validar TypeScript, lint, tests, seguridad Supabase y build.
