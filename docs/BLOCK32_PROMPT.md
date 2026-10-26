# Prompt operativo · Bloque 32 — Alta completa de tenant con invitación de propietario

Continúa sobre el repositorio actual con B20–B31 cerrados salvo regresión nueva. B32 elimina el paso manual que obligaba al futuro propietario a crear primero una cuenta de cliente antes de que un ADMIN global pudiera dar de alta su negocio.

## Objetivo

- Permitir que `/admin-global` cree un tenant usando el correo real del propietario aunque ese correo todavía no exista en Supabase Auth.
- Reutilizar `platform_admin_create_business` como única operación autoritativa de creación del tenant.
- Si la RPC responde `owner_account_not_found`, enviar una invitación oficial de Supabase Auth y reintentar la misma RPC.
- Si el correo ya existe, conservar el flujo actual sin enviar una invitación duplicada.
- El propietario invitado completa su contraseña mediante `/admin/activar`, ya existente.

## Seguridad

- El navegador no recibe ni usa `service_role`, secret keys ni `user_id` del futuro propietario.
- La nueva Edge `platform-business-onboarding` exige JWT válido y vuelve a comprobar que `user_accounts.role='admin'` e `is_active=true`.
- La llamada a `platform_admin_create_business` se hace con el JWT del ADMIN global, de modo que la validación `is_platform_admin()` de B20 sigue siendo autoritativa.
- La Edge acepta una allowlist estricta de campos de negocio; actor, roles y `user_id` nunca vienen del body.
- `platform_admin_create_business` conserva las invariantes B20: no ADMIN global como owner, un negocio por cuenta propietaria, validación de slug/moneda/timezone/teléfono y alta atómica de business + user_accounts + profile.
- La invitación Auth solo se intenta después de `owner_account_not_found`.
- Si la invitación fue creada por B32 y el reintento del alta falla, borrar únicamente ese Auth user recién invitado para no dejar una identidad huérfana.
- Si una carrera crea la cuenta entre el primer intento y la invitación, reintentar la RPC sin borrar la identidad ajena.
- `verify_jwt = true` es obligatorio en `supabase/config.toml`.

## UX

- Quitar el mensaje que exigía “crear primero una cuenta en Mi cuenta”.
- Explicar que una cuenta existente se vincula y una inexistente recibe invitación segura para crear contraseña.
- Distinguir éxito con owner existente de éxito con invitación enviada.
- Mantener feedback accesible `role=status` / `role=alert`, formulario con validación nativa y estado busy.

## Límites

- B32 no cambia la restricción actual de un negocio por cuenta propietaria; el soporte administrativo multi-negocio requiere un cambio estructural posterior.
- No implementa recuperación extraordinaria de propietario principal por ADMIN global; B21 mantiene la transferencia ordinaria dentro del tenant.
- No crea acceso operativo cross-tenant para el ADMIN global.
- No introduce pagos, chat interno ni campañas.
- No hace deploy, push, merge ni migraciones remotas sin autorización explícita.

## Validación obligatoria

1. `git diff --check`
2. `npm run typecheck`
3. `npm run lint`
4. Tests enfocados `platform-inventory`, `platform-owner-onboarding` y `admin-auth-ui`.
5. `npm test`
6. `npm run validate:supabase-security`
7. `npm run qa`
8. `npm run validate:repo`
9. `npm run build`
10. `npm audit --audit-level=moderate`

No hay cambio de esquema en B32. La validación local de la Edge debe comprobar configuración JWT, autorización ADMIN, invitación condicionada, rollback y carrera de cuenta existente. El deploy de la nueva Edge queda pendiente de autorización de producción.
