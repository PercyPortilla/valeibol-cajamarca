# Prompt operativo · Bloque 21 — Transferencia segura del propietario principal

Trabaja sobre B14–B20 ya validados. B21 implementa el flujo explícito que B20 dejó deliberadamente bloqueado: cambiar `businesses.owner_user_id` sin convertir un cambio de rol común en una transferencia de propiedad.

## Principios

- `profiles.role='owner'` significa permiso de gestión como Propietario; `businesses.owner_user_id` identifica al único Propietario principal.
- La transferencia ordinaria pertenece al tenant, no al ADMIN global.
- Solo el propietario principal actual puede iniciarla.
- El destino debe ser un miembro ya existente del mismo negocio, con perfil activo, `user_accounts` activo y correo Auth confirmado.
- Una cuenta `user_accounts.role='admin'` (ADMIN global) nunca puede recibir propiedad tenant.
- El navegador no llama directamente a la RPC: usa `admin-access-management`, que valida JWT y ejecuta con service role.
- No aceptar `business_id` desde el cliente; se deriva del propietario principal actual.

## Operación atómica

Crear `admin_access_transfer_primary_owner(actor,target)` como `SECURITY INVOKER`, ejecutable solo por `service_role`.

1. Resolver el tenant del actor y bloquear primero sus `profiles`, igual que `admin_access_update_profile`.
2. Revalidar al actor como OWNER activo; después bloquear `businesses` con `FOR UPDATE` y exigir `owner_user_id = actor` + negocio activo.
3. Validar target del mismo tenant y bloquear su `user_accounts`.
4. Exigir target activo, email confirmado y cuenta global activa/no ADMIN.
5. Promover target a `profiles.role='owner'` y `user_accounts.role='owner'`.
6. Cambiar `businesses.owner_user_id` al target.
7. Mantener al propietario anterior como OWNER activo. Su degradación/desactivación posterior es una acción separada.

La invariante ADMIN-global/OWNER-tenant se protege en las tres superficies de escritura (`profiles`, `user_accounts` y `businesses.owner_user_id`). Las guardias toman el mismo `pg_advisory_xact_lock` por usuario antes de consultar la tabla opuesta, evitando write-skew entre transacciones concurrentes.

## Edge

- Nueva action `{ action: 'transfer_owner', userId }`.
- `p_actor_user_id` siempre sale del JWT validado, nunca del body.
- El listado de accesos devuelve `isPrimaryOwner`, `canReceivePrimaryOwnership` y `canTransferPrimaryOwnership`; no serializa `owner_user_id` crudo.
- Elegibilidad se calcula con estado real de profile, Auth y user_accounts.
- Errores de stale principal, target inactivo/no confirmado/no perteneciente y ADMIN global se convierten a códigos explícitos.

## UX

- Única superficie: Configuración → Usuarios y accesos.
- Mostrar badge `Propietario principal`.
- El CTA solo aparece al principal actual y solo en candidatos elegibles.
- El cambio de rol común NO transfiere propiedad.
- Segunda confirmación inline accesible con el negocio, correo del nuevo principal y consecuencia: el anterior conserva acceso Owner.
- Foco inicial en `Cancelar`, errores con `role=alert`, éxito con `role=status`, busy `Transfiriendo…`, targets >=44px.
- ADMIN global no obtiene botón de transferencia ni owner PII.

## Límites

- No mover usuarios entre tenants.
- No crear usuarios durante la transferencia.
- No transferir a invitaciones pendientes/no confirmadas.
- No degradar automáticamente al owner anterior.
- No implementar recuperación extraordinaria por ADMIN global en este bloque.
- No hacer commit, push, migraciones remotas ni deploy sin autorización explícita.

## Validación

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run validate:repo`
5. `npm run validate:supabase-security`
6. `npm run qa`
7. `npm run build`
8. `npm audit --audit-level=moderate`
9. `git diff --check`

Ejecutar `supabase/tests/platform_ownership.sql` si existe Postgres local; si no, reportar la limitación sin simular PASS.

\n