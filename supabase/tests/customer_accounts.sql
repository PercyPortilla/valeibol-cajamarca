-- Plataforma global · Bloque 7
\set ON_ERROR_STOP on
begin;

do $$
declare
  history_args text;
  history_def text;
begin
  select pg_get_function_arguments('public.get_my_reservations()'::regprocedure),
         pg_get_functiondef('public.get_my_reservations()'::regprocedure)
  into history_args, history_def;

  if coalesce(history_args, '') <> '' then
    raise exception 'FAIL: historial propio no debe aceptar user_id: %', history_args;
  end if;
  if history_def not like '%auth.uid()%' then
    raise exception 'FAIL: historial propio no deriva auth.uid()';
  end if;
  if has_function_privilege('anon', 'public.get_my_reservations()', 'EXECUTE') then
    raise exception 'FAIL: anon no debe leer historial cliente';
  end if;
  if not has_function_privilege('authenticated', 'public.get_my_reservations()', 'EXECUTE') then
    raise exception 'FAIL: authenticated necesita leer su historial';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.link_public_reservation_user(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.link_public_reservation_user(uuid,uuid)', 'EXECUTE') then
    raise exception 'FAIL: vínculo de usuario no puede ejecutarse desde navegador';
  end if;
end $$;

rollback;
\echo 'PASS customer_accounts.sql · historial propio y vínculo server-only'
