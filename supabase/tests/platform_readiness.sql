do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.admin_set_business_configuration_status(public.configuration_status)'::regprocedure)
  into definition;
  definition := lower(definition);
  if definition not like '%phase6_admin_actor()%'
     or definition not like '%for update%'
     or definition not like '%business_publication_readiness%'
     or definition like '%p_business_id%' then
    raise exception 'FAIL: publication RPC must derive tenant and serialize on business';
  end if;

  if not has_function_privilege('authenticated', 'public.admin_set_business_configuration_status(public.configuration_status)', 'EXECUTE') then
    raise exception 'FAIL: authenticated admin role needs publication RPC execute';
  end if;
  if has_function_privilege('anon', 'public.admin_set_business_configuration_status(public.configuration_status)', 'EXECUTE') then
    raise exception 'FAIL: anon must not execute publication mutation';
  end if;

  select pg_get_functiondef('public.admin_set_court_active(uuid,boolean)'::regprocedure)
  into definition;
  definition := lower(definition);
  if definition not like '%from public.businesses b%for update%'
     or definition not like '%from public.courts c%for update%'
     or definition not like '%published_business_requires_ready_court%'
     or definition not like '%business_publication_readiness%' then
    raise exception 'FAIL: court activation must serialize on business and preserve published readiness';
  end if;

  select pg_get_functiondef('private.guard_new_reservation_business_published()'::regprocedure)
  into definition;
  definition := lower(definition);
  if definition not like '%new.source = ''public_web''%'
     or definition not like '%configuration_status = ''confirmed''%'
     or definition not like '%business_not_published%' then
    raise exception 'FAIL: reservation insert guard must require published business';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'reservations'
      and t.tgname = 'reservations_require_published_business'
      and not t.tgisinternal
  ) then
    raise exception 'FAIL: reservations publication trigger missing';
  end if;
end;
$$;
