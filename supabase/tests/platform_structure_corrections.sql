-- Plataforma global · Bloque 28
\set ON_ERROR_STOP on
begin;

do $$
declare
  venue_definition text;
  court_definition text;
begin
  select lower(pg_get_functiondef('public.admin_update_venue_slug(uuid,text)'::regprocedure))
  into venue_definition;
  if venue_definition not like '%phase6_admin_actor()%'
     or venue_definition not like '%role not in (''owner'', ''admin'')%'
     or venue_definition not like '%configuration_status <> ''provisional''%'
     or venue_definition not like '%for update%'
     or venue_definition not like '%venue_slug_taken%' then
    raise exception 'FAIL: B28 venue correction guards missing';
  end if;

  select lower(pg_get_functiondef('public.admin_update_court_structure(uuid,uuid,uuid,text)'::regprocedure))
  into court_definition;
  if court_definition not like '%phase6_admin_actor()%'
     or court_definition not like '%configuration_status <> ''provisional''%'
     or court_definition not like '%court_must_be_inactive_for_structure_correction%'
     or court_definition not like '%court_structure_change_blocked_by_reservation_history%'
     or court_definition not like '%court_structure_change_blocked_by_schedule_history%'
     or court_definition not like '%target_venue_not_found_or_inactive%'
     or court_definition not like '%target_sport_not_found_or_inactive%'
     or court_definition not like '%availability_revisions%' then
    raise exception 'FAIL: B28 court correction guards missing';
  end if;

  if has_function_privilege('anon', 'public.admin_update_venue_slug(uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_update_court_structure(uuid,uuid,uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: anon must not execute B28 corrections';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_update_venue_slug(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_update_court_structure(uuid,uuid,uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: authenticated tenant admins need B28 RPC execute';
  end if;
end;
$$;

rollback;
\echo 'PASS platform_structure_corrections.sql · safe pre-history corrections B28'
