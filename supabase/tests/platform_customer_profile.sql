-- Plataforma global · Bloque 38
\set ON_ERROR_STOP on
begin;

do $$
declare
  getter text;
  updater text;
begin
  select lower(pg_get_functiondef('public.get_my_customer_profile()'::regprocedure)) into getter;
  select lower(pg_get_functiondef('public.update_my_customer_profile(text,text)'::regprocedure)) into updater;
  if getter not like '%auth.uid()%'
     or getter like '%role =%'
     or updater not like '%auth.uid()%'
     or updater not like '%set display_name = v_display_name%phone_e164 = v_phone_e164%'
     or updater like '%set role =%'
     or updater like '%set is_active =%'
  then
    raise exception 'FAIL: B38 rompe identidad propia o intenta modificar privilegios';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.get_my_customer_profile()', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_my_customer_profile(text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon puede leer/escribir perfil B38';
  end if;
end $$;

rollback;
\echo 'PASS platform_customer_profile.sql · customer profile B38'

