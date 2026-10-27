-- Caxas SportCenter · administración de plataforma separada de los tenants.
--
-- Regla vigente:
-- - user_accounts.role = 'admin' autoriza la administración madre.
-- - profiles conserva el rol operativo de cada tenant.
-- - un ADMIN global puede conservar una membresía tenant existente, pero el
--   acceso operativo sigue requiriendo selección explícita del negocio.
-- - se permite más de un ADMIN global activo para el equipo de plataforma.

drop index if exists public.user_accounts_single_active_platform_admin;

drop trigger if exists user_accounts_block_tenant_owner_admin on public.user_accounts;
drop trigger if exists profiles_block_platform_admin_owner on public.profiles;
drop trigger if exists businesses_block_platform_admin_primary_owner on public.businesses;

comment on column public.user_accounts.role is
  'Rol global de plataforma. ADMIN autoriza la administración madre; los roles tenant permanecen separados en profiles.';
