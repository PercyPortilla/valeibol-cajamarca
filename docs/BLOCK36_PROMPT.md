# BLOQUE 36 — Recuperación extraordinaria del propietario principal

Trabaja sobre B20–B35 ya cerrados salvo regresión real. B21 cubre la transferencia ordinaria únicamente cuando el propietario principal actual puede operar el tenant; B36 agrega una ruta de recuperación extraordinaria exclusiva del único ADMIN global para evitar tenants huérfanos.

## Objetivo

- Permitir que `/admin-global` asigne un nuevo propietario principal a un tenant concreto cuando la recuperación ordinaria B21 no sea posible.
- Resolver al nuevo propietario por correo dentro del backend; el navegador nunca aporta `user_id` ni actor autoritativo.
- Si la cuenta ya existe y es elegible, vincularla/promoverla al mismo tenant.
- Si no existe, enviar una invitación oficial de Supabase Auth y reintentar la recuperación.
- Si el propietario principal cambia realmente, desactivar su profile tenant anterior para que una cuenta comprometida no conserve control operativo. No borrar ni desactivar su identidad global.

## Seguridad

- `platform_admin_recover_primary_owner(business_id,email)` exige `is_platform_admin()` dentro de PostgreSQL.
- `anon` no recibe `EXECUTE`; `authenticated` puede invocar, pero solo el ADMIN global supera la autorización interna.
- El target nunca puede ser la cuenta ADMIN global.
- Una identidad con profile u ownership en otro tenant se rechaza con `owner_already_assigned`; B36 no habilita multi-negocio.
- Una cuenta global inactiva no se reactiva silenciosamente.
- Una cuenta existente debe tener correo confirmado; una identidad creada por la invitación oficial del propio flujo puede quedar preparada antes de aceptar el enlace.
- Locks siguen el orden B21: perfiles del tenant → business → `user_accounts` target, evitando invertir el orden de transferencia ordinaria.
- Los triggers B21 siguen protegiendo la invariante ADMIN-global/OWNER mediante advisory locks.
- La Edge `platform-owner-recovery` exige JWT, vuelve a validar `user_accounts.role='admin' && is_active`, usa la identidad JWT para la RPC y nunca acepta actor/role/user_id del body.
- Si la Edge creó una invitación y la recuperación falla, borra solo ese Auth user recién creado. Una carrera `email_in_use` reintenta la RPC sin borrar identidad ajena.

## UX global

- Cada tenant en `/admin-global` ofrece `Recuperar propietario` como acción extraordinaria separada de `Administrar negocio`.
- Se solicita únicamente el correo del nuevo propietario.
- Confirmación explícita antes de cambiar ownership.
- Éxito distingue cuenta existente de invitación enviada.
- Errores específicos: cuenta en otro tenant, cuenta global inactiva, ADMIN global, negocio inexistente, rate limit/invitación fallida.
- No mostrar `owner_user_id`, correo del propietario actual ni otra PII en el listado global.

## Límites

- No mover usuarios entre tenants.
- No convertir al ADMIN global en OWNER.
- No borrar ni desactivar la identidad global del propietario anterior; únicamente su profile dentro del tenant recuperado.
- No ampliar el modelo a multi-negocio por usuario.
- No tocar reservas, pagos, publicación, catálogo ni RLS público.
- No hacer commit, push, deploy ni migraciones remotas sin autorización explícita.

## Validación obligatoria

1. `git diff --check`.
2. `npm run typecheck`.
3. `npm run lint`.
4. Tests focales `platform-owner-recovery` + `platform-ownership` + `platform-owner-onboarding` + `platform-admin`.
5. `npm test`.
6. `npm run validate:supabase-security`.
7. `npm run qa`.
8. `npm run validate:repo`.
9. `npm run build`.
10. `npm audit --audit-level=moderate`.
11. SQL E2E `platform_owner_recovery.sql` cuando Docker/Supabase local esté disponible.

