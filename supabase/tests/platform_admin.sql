-- Plataforma global · Bloque 9
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.get_platform_admin_context()'::regprocedure) into definition;
  if definition not like '%public.user_accounts%' or definition not like '%ua.role = ''admin''%' then
    raise exception 'FAIL: contexto global no valida platform_role admin';
  end if;
  if definition like '%public.profiles%' then
    raise exception 'FAIL: admin de negocio no debe conceder admin global';
  end if;

  if has_function_privilege('anon', 'public.get_platform_admin_summary()', 'EXECUTE')
     or has_function_privilege('anon', 'public.platform_admin_set_business_active(uuid,boolean)', 'EXECUTE') then
    raise exception 'FAIL: anon no debe ejecutar administración global';
  end if;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.platform_admin_set_business_active(uuid,boolean)'::regprocedure) into definition;
  if definition not like '%public.is_platform_admin()%' then
    raise exception 'FAIL: mutación global no valida is_platform_admin';
  end if;
  if definition like '%delete from public.businesses%' then
    raise exception 'FAIL: Bloque 9 no debe habilitar borrado destructivo de tenants';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin.sql · rol global/privilegios/mutaciones no destructivas'
