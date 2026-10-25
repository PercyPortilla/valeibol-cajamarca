do $$
declare
  public_definition text;
  admin_definition text;
  mutation_definition text;
  toggle_definition text;
begin
  select pg_get_functiondef('public.get_public_sports()'::regprocedure) into public_definition;
  if lower(public_definition) not like '%where s.is_active%' then
    raise exception 'FAIL: public sports must expose active rows only';
  end if;

  select pg_get_functiondef('public.get_platform_admin_sports()'::regprocedure) into admin_definition;
  if lower(admin_definition) not like '%is_platform_admin()%'
     or lower(admin_definition) not like '%count(c.id) filter (where c.is_active)%' then
    raise exception 'FAIL: global sport list must require platform ADMIN and count active courts';
  end if;

  select pg_get_functiondef('public.platform_admin_upsert_sport(uuid,text,text,text,integer)'::regprocedure) into mutation_definition;
  if lower(mutation_definition) not like '%is_platform_admin()%'
     or lower(mutation_definition) not like '%sport_slug_taken%'
     or lower(mutation_definition) not like '%for update%' then
    raise exception 'FAIL: sport mutation guards missing';
  end if;

  select pg_get_functiondef('public.platform_admin_set_sport_active(uuid,boolean)'::regprocedure) into toggle_definition;
  if lower(toggle_definition) not like '%is_platform_admin()%'
     or lower(toggle_definition) not like '%sport_has_active_courts%'
     or lower(toggle_definition) not like '%for update%' then
    raise exception 'FAIL: sport activation guards missing';
  end if;

  if has_function_privilege('anon', 'public.platform_admin_upsert_sport(uuid,text,text,text,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.platform_admin_set_sport_active(uuid,boolean)', 'EXECUTE') then
    raise exception 'FAIL: anon must not mutate global sports';
  end if;
  if not has_function_privilege('anon', 'public.get_public_sports()', 'EXECUTE') then
    raise exception 'FAIL: anon needs read-only public sports RPC';
  end if;
end;
$$;
