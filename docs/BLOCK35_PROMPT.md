# BLOQUE 35 — Recuperación de contraseña para clientes

Trabaja sobre B20–B34 ya cerrados salvo regresión real. B35 cierra un hueco del lifecycle de `Mi cuenta`: los clientes podían crear cuenta e iniciar sesión con contraseña, pero no tenían una forma de recuperarla si la olvidaban, aunque el flujo administrativo ya utilizaba la recuperación oficial de Supabase Auth.

## Objetivo

- Añadir `Olvidé mi contraseña` al login de clientes.
- Usar `supabase.auth.resetPasswordForEmail` con el callback seguro existente.
- Redirigir únicamente a `/mi-cuenta/recuperar` mediante `safeAuthRedirectPath`.
- Permitir que la sesión creada por el enlace de recuperación establezca una nueva contraseña con `supabase.auth.updateUser({ password })`.
- Mantener historial, favoritos, reseñas y reservas sin cambios.

## Seguridad

- No revelar si un correo existe: después de solicitar recuperación se muestra un mensaje genérico.
- El navegador nunca recibe `service_role`, `user_id`, `business_id` ni otra identidad autoritativa.
- `/auth/callback` sigue intercambiando el code server-side y acepta únicamente rutas internas permitidas por `safeAuthRedirectPath`.
- `/mi-cuenta/recuperar` comprueba `supabase.auth.getUser()` server-side antes de mostrar el formulario de nueva contraseña.
- Una visita directa sin sesión de recuperación válida muestra error y no ejecuta ninguna mutación.
- Nueva contraseña: mínimo 8 caracteres y confirmación coincidente antes de llamar a Auth.
- La ruta es `noindex, nofollow`.

## UX

- `Olvidé mi contraseña` aparece solo en modo de inicio de sesión.
- El correo ya escrito se reutiliza como destino de recuperación.
- Estado busy impide solicitudes duplicadas desde la misma interacción.
- Éxito y error usan `role=status` / `role=alert`.
- Tras actualizar la contraseña se ofrece volver a `Mi cuenta`.

## Límites

- No reclamar reservas guest antiguas.
- No cambiar email, roles, tenants, reservas ni RLS.
- No añadir RPC o migración SQL.
- No cambiar recuperación administrativa existente.
- No hacer commit, push, deploy ni cambios remotos sin autorización explícita.

## Validación obligatoria

1. `git diff --check`.
2. `npm run typecheck`.
3. `npm run lint`.
4. Tests focales `customer-password-recovery` + `customer-account` + `admin-auth-ui`.
5. `npm test`.
6. `npm run validate:supabase-security`.
7. `npm run qa`.
8. `npm run validate:repo`.
9. `npm run build`.
10. `npm audit --audit-level=moderate`.

