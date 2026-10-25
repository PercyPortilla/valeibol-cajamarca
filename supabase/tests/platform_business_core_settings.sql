do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.platform_admin_update_business_core(uuid,text,text,text)'::regprocedure)
  into definition;
  if lower(definition) not like '%is_platform_admin()%'
     or lower(definition) not like '%for update%'
     or lower(definition) not like '%configuration_status <> ''provisional''%'
     or lower(definition) not like '%currency_change_blocked_by_reservation_history%'
     or lower(definition) not like '%timezone_change_blocked_by_schedule_history%' then
    raise exception 'FAIL: B25 core settings guards missing';
  end if;

  if has_function_privilege('anon', 'public.platform_admin_update_business_core(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon must not execute B25 mutation';
  end if;
  if not has_function_privilege('authenticated', 'public.platform_admin_update_business_core(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: authenticated role needs RPC execute; function rechecks platform ADMIN';
  end if;
end;
$$;

\n