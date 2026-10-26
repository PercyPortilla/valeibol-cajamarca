-- Plataforma global · Bloque 36
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.platform_admin_recover_primary_owner(uuid,text)'::regprocedure)
  into definition;
  definition := lower(definition);

  if definition not like '%public.is_platform_admin()%'
     or definition not like '%from auth.users%'
     or definition not like '%lower(u.email) = v_owner_email%'
     or definition not like '%u.email_confirmed_at is not null or u.invited_at is not null%'
     or definition not like '%owner_account_unconfirmed%' then
    raise exception 'FAIL: B36 no valida ADMIN global o no resuelve owner por email';
  end if;
  if definition not like '%perform 1%from public.profiles%for update%'
     or definition not like '%from public.businesses b%for update%'
     or definition not like '%from public.user_accounts ua%for update%' then
    raise exception 'FAIL: B36 no mantiene locks de recuperación';
  end if;
  if definition not like '%platform_admin_cannot_be_tenant_owner%'
     or definition not like '%owner_already_assigned%'
     or definition not like '%v_previous_owner_user_id <> v_owner_user_id%'
     or definition not like '%set is_active = false%'
     or definition not like '%update public.businesses%owner_user_id = v_owner_user_id%' then
    raise exception 'FAIL: B36 no protege identidad/cross-tenant, no revoca principal anterior o no recupera owner';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.platform_admin_recover_primary_owner(uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: anon puede ejecutar recuperación B36';
  end if;
  if not has_function_privilege('authenticated', 'public.platform_admin_recover_primary_owner(uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: ADMIN global autenticado no puede invocar recuperación B36';
  end if;
end $$;

rollback;
\echo 'PASS platform_owner_recovery.sql · platform owner recovery B36'

