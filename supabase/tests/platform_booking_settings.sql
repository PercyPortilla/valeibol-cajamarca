-- Plataforma global · Bloque 23
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
  hours_definition text;
begin
  select pg_get_functiondef('public.admin_update_booking_increment(smallint)'::regprocedure) into definition;
  select pg_get_functiondef('public.admin_schedule_court_operating_hours(uuid,jsonb,date)'::regprocedure) into hours_definition;
  definition := lower(definition);
  hours_definition := lower(hours_definition);
  if definition not like '%phase6_admin_actor()%'
     or definition like '%p_business_id%'
     or definition not like '%role not in (''owner'', ''admin'')%' then
    raise exception 'FAIL: B23 no deriva tenant/rol de auth';
  end if;
  if definition not like '%for update%'
     or definition not like '%booking_increment_conflict_future_reservations%'
     or definition not like '%booking_increment_conflict_future_blocks%' then
    raise exception 'FAIL: B23 no serializa o no protege agenda futura';
  end if;
  if definition not like '%availability_revisions%'
     or definition not like '%booking_increment_minutes = p_booking_increment_minutes%' then
    raise exception 'FAIL: B23 no actualiza setting/revisión';
  end if;
  if hours_definition not like '%from public.businesses b%'
     or hours_definition not like '%for update%'
     or hours_definition not like '%v_business.booking_increment_minutes%' then
    raise exception 'FAIL: B22/B23 no comparten lock business/setting actual';
  end if;
  if has_function_privilege('anon', 'public.admin_update_booking_increment(smallint)', 'EXECUTE') then
    raise exception 'FAIL: anon no debe modificar booking_increment';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_update_booking_increment(smallint)', 'EXECUTE') then
    raise exception 'FAIL: authenticated no puede invocar RPC B23';
  end if;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.get_admin_booking_settings()'::regprocedure) into definition;
  definition := lower(definition);
  if definition not like '%phase6_admin_actor()%' or definition not like '%booking_increment_minutes%' then
    raise exception 'FAIL: lectura B23 no deriva setting desde tenant autenticado';
  end if;
end $$;

rollback;
\echo 'PASS platform_booking_settings.sql · granularidad/guards B23'
