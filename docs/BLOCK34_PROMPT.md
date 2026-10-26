# BLOQUE 34 — Vinculación de cuentas Caxas existentes al acceso de un tenant

Trabaja sobre B20–B33 ya cerrados salvo regresión real. B34 elimina el callejón sin salida de `Configuración → Usuarios y accesos`: hasta ahora el OWNER solo podía agregar personas mediante una invitación Auth nueva, por lo que un correo que ya tenía cuenta en Caxas fallaba como `email_in_use` y exigía intervención manual.

## Objetivo

- Permitir que un OWNER agregue como Propietario/Administrador/Personal a una persona que ya tenga una cuenta Supabase Auth confirmada.
- Si el correo todavía no existe, conservar el flujo de invitación y activación existente.
- Resolver el usuario por email dentro del backend privilegiado; el navegador nunca aporta `user_id` para esta alta.
- No crear cuentas Auth duplicadas ni perfiles paralelos.

## Seguridad y aislamiento

- `admin_access_link_existing_profile(actor,email,role,display_name)` es `SECURITY INVOKER` y solo `service_role` puede ejecutarla.
- El actor debe seguir siendo un `profiles.role='owner'` activo de un negocio activo.
- La cuenta destino debe existir en Auth, tener correo confirmado y `user_accounts.is_active=true`.
- Una cuenta `user_accounts.role='admin'` (ADMIN global) nunca puede recibir un perfil tenant por esta vía.
- Si el usuario ya pertenece a otro tenant, devolver `user_assigned_elsewhere`; no mover usuarios entre negocios.
- Si ya pertenece al mismo tenant, no reutilizar el alta para modificarlo: su rol/estado se gestiona desde la lista existente.
- La identidad objetivo usa el mismo advisory lock de las invariantes ADMIN-global/OWNER de B21 para evitar carreras incompatibles.
- `anon` y `authenticated` no reciben `EXECUTE` directo sobre la RPC.

## Edge Function

Para `action='invite'` en `admin-access-management`:

1. intentar primero `admin_access_link_existing_profile` con el email normalizado;
2. si existe y es elegible, devolver el usuario sanitizado con `accessMode='linked'`;
3. solo ante `existing_account_not_found`, llamar `inviteUserByEmail`;
4. si la invitación responde `email_in_use` por una carrera, reintentar una vez la vinculación autoritativa;
5. si se creó una nueva identidad y luego falla la creación del perfil, conservar el rollback Auth existente;
6. distinguir errores de cuenta no confirmada, cuenta inactiva, otro tenant y ADMIN global.

## UX

- El CTA pasa de “Invitar usuario” a “Agregar usuario”.
- Explicar que un correo existente se vincula y uno nuevo recibe invitación.
- Mostrar éxito diferente para `linked` e `invited`.
- Mostrar errores específicos para cuenta ya asignada, no confirmada, inactiva, ya perteneciente al tenant o ADMIN global.
- Mantener roles, transferencia de propietario B21, feedback accesible y estados busy existentes.

## Límites

- No habilitar multi-negocio por usuario; el `profiles.user_id` actual sigue siendo único.
- No mover una cuenta desde otro tenant.
- No permitir que el ADMIN global adquiera un perfil tenant.
- No cambiar recuperación de contraseña, reservas, pagos, publicación ni catálogo.
- No hacer commit, push, migraciones remotas ni deploy sin autorización explícita.

## Validación obligatoria

1. `git diff --check`.
2. `npm run typecheck`.
3. `npm run lint`.
4. Test focal `platform-existing-account-access` + `admin-auth-ui` + `platform-ownership`.
5. `npm test`.
6. `npm run validate:supabase-security`.
7. `npm run qa`.
8. `npm run validate:repo`.
9. `npm run build`.
10. `npm audit --audit-level=moderate`.
11. SQL E2E `platform_existing_account_access.sql` cuando Docker/Supabase local esté disponible.

