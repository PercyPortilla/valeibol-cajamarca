-- Plataforma global · Bloque 34
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.admin_access_link_existing_profile(uuid,text,public.app_role,text)'::regprocedure)
  into definition;
  definition := lower(definition);

  if definition not like '%from auth.users%'
     or definition not like '%lower(u.email) = v_email%'
     or definition not like '%u.email_confirmed_at is not null%' then
    raise exception 'FAIL: B34 no resuelve una cuenta Auth confirmada por email';
  end if;
  if definition not like '%p.role = ''owner''%'
     or definition not like '%b.is_active%'
     or definition not like '%user_assigned_elsewhere%' then
    raise exception 'FAIL: B34 no conserva owner/tenant activo o aislamiento cross-tenant';
  end if;
  if definition not like '%v_account.role = ''admin''%'
     or definition not like '%platform_admin_cannot_join_tenant%'
     or definition not like '%pg_advisory_xact_lock%' then
    raise exception 'FAIL: B34 no protege ADMIN global o concurrencia de identidad';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.admin_access_link_existing_profile(uuid,text,public.app_role,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_access_link_existing_profile(uuid,text,public.app_role,text)', 'EXECUTE') then
    raise exception 'FAIL: navegador puede ejecutar la vinculación B34 directamente';
  end if;
  if not has_function_privilege('service_role', 'public.admin_access_link_existing_profile(uuid,text,public.app_role,text)', 'EXECUTE') then
    raise exception 'FAIL: service_role no puede ejecutar la vinculación B34';
  end if;
end $$;

rollback;
\echo 'PASS platform_existing_account_access.sql · existing account tenant access B34'

