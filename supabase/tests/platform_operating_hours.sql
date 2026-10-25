-- Plataforma global · Bloque 22
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.admin_schedule_court_operating_hours(uuid,jsonb,date)'::regprocedure) into definition;
  definition := lower(definition);
  if definition not like '%phase6_admin_actor()%'
     or definition like '%p_business_id%'
     or definition not like '%role not in (''owner'', ''admin'')%' then
    raise exception 'FAIL: horario regular no deriva tenant/rol de auth';
  end if;
  if definition not like '%for update%'
     or definition not like '%operating_hours_conflict_future_reservations%'
     or definition not like '%operating_hours_conflict_future_blocks%' then
    raise exception 'FAIL: horario regular no serializa/protege agenda futura';
  end if;
  if definition not like '%effective_until = p_effective_from - 1%'
     or definition like '%delete from public.operating_hours%'
     or definition not like '%availability_revisions%' then
    raise exception 'FAIL: versionado o refresco de disponibilidad incompleto';
  end if;
  if has_function_privilege('anon', 'public.admin_schedule_court_operating_hours(uuid,jsonb,date)', 'EXECUTE') then
    raise exception 'FAIL: anon no debe programar horarios';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_schedule_court_operating_hours(uuid,jsonb,date)', 'EXECUTE') then
    raise exception 'FAIL: owner/admin autenticado no puede invocar RPC B22';
  end if;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.get_admin_business_structure()'::regprocedure) into definition;
  definition := lower(definition);
  if definition not like '%operatinghours%' or definition not like '%public.operating_hours%' then
    raise exception 'FAIL: estructura admin no expone horario vigente/futuro';
  end if;
end $$;

rollback;
\echo 'PASS platform_operating_hours.sql · versionado/guards B22'
