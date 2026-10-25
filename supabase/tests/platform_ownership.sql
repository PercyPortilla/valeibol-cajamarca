-- Plataforma global · Bloque 21
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.admin_access_transfer_primary_owner(uuid,uuid)'::regprocedure) into definition;
  definition := lower(definition);
  if definition not like '%b.owner_user_id = p_actor_user_id%'
     or definition not like '%p.business_id = v_business.id%'
     or definition not like '%u.email_confirmed_at is not null%' then
    raise exception 'FAIL: transferencia no valida principal/tenant/confirmación';
  end if;
  if definition not like '%platform_admin_cannot_be_tenant_owner%'
     or definition not like '%update public.businesses%owner_user_id = p_target_user_id%' then
    raise exception 'FAIL: transferencia no protege ADMIN global o no cambia owner autoritativo';
  end if;
  if has_function_privilege('anon', 'public.admin_access_transfer_primary_owner(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_access_transfer_primary_owner(uuid,uuid)', 'EXECUTE') then
    raise exception 'FAIL: navegador puede ejecutar transferencia directa';
  end if;
  if not has_function_privilege('service_role', 'public.admin_access_transfer_primary_owner(uuid,uuid)', 'EXECUTE') then
    raise exception 'FAIL: service_role no puede ejecutar transferencia';
  end if;
end $$;

do $$
declare
  profile_guard text;
  account_guard text;
  business_guard text;
begin
  select pg_get_functiondef('private.guard_profile_owner_not_platform_admin()'::regprocedure) into profile_guard;
  select pg_get_functiondef('private.guard_platform_admin_not_tenant_owner()'::regprocedure) into account_guard;
  select pg_get_functiondef('private.guard_business_primary_owner_not_platform_admin()'::regprocedure) into business_guard;
  if profile_guard not like '%platform_admin_cannot_be_tenant_owner%'
     or account_guard not like '%tenant_owner_cannot_be_platform_admin%'
     or business_guard not like '%platform_admin_cannot_be_tenant_owner%' then
    raise exception 'FAIL: invariante ADMIN global/OWNER tenant incompleta';
  end if;
  if profile_guard not like '%pg_advisory_xact_lock%'
     or account_guard not like '%pg_advisory_xact_lock%'
     or business_guard not like '%pg_advisory_xact_lock%' then
    raise exception 'FAIL: invariante ADMIN global/OWNER tenant no serializa escrituras concurrentes';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.businesses'::regclass
      and tgname = 'businesses_block_platform_admin_primary_owner'
      and not tgisinternal
  ) then
    raise exception 'FAIL: businesses.owner_user_id no tiene guardia contra ADMIN global';
  end if;
end $$;

rollback;
\echo 'PASS platform_ownership.sql · primary owner transfer B21'
