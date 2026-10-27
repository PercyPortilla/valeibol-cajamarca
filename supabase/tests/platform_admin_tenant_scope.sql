-- Ajuste previo a B33 · scope operativo ADMIN global + Cajamarca.
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('private.platform_admin_selected_business_id()'::regprocedure) into definition;
  definition := lower(definition);
  if definition not like '%x-platform-business-id%'
     or definition not like '%is_platform_admin()%'
     or definition not like '%request.headers%' then
    raise exception 'FAIL: scope global no exige header + ADMIN global';
  end if;
end $$;

do $$
declare
  context_def text;
  actor_def text;
begin
  select pg_get_functiondef('public.get_current_admin_context()'::regprocedure) into context_def;
  select pg_get_functiondef('public.phase6_admin_actor()'::regprocedure) into actor_def;
  context_def := lower(context_def);
  actor_def := lower(actor_def);
  if context_def not like '%platform_admin_selected_business_id()%'
     or actor_def not like '%platform_admin_selected_business_id()%'
     or actor_def not like '%''admin''::public.app_role%' then
    raise exception 'FAIL: contexto tenant no integra scope del ADMIN global';
  end if;
  if context_def not like '%from public.profiles%'
     or actor_def not like '%from public.profiles%' then
    raise exception 'FAIL: owners/admin/staff tenant perdieron resolución por profile';
  end if;
end $$;

do $$
declare
  catalog_def text;
  guard_def text;
begin
  select pg_get_functiondef('public.get_public_platform_catalog(text,text)'::regprocedure) into catalog_def;
  select pg_get_functiondef('private.guard_new_reservation_business_published()'::regprocedure) into guard_def;
  catalog_def := lower(catalog_def);
  guard_def := lower(guard_def);
  if catalog_def not like '%= ''cajamarca''%'
     or catalog_def not like '%lower(trim(p_city)) = ''cajamarca''%' then
    raise exception 'FAIL: catálogo público no está restringido a Cajamarca';
  end if;
  if guard_def not like '%public_web%'
     or guard_def not like '%= ''cajamarca''%' then
    raise exception 'FAIL: alta de reserva pública no está restringida a Cajamarca';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'user_accounts'
      and indexname = 'user_accounts_single_active_platform_admin'
  ) then
    raise exception 'FAIL: la plataforma todavía limita el equipo a un único ADMIN global';
  end if;
  if exists (
    select 1
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'user_accounts_block_tenant_owner_admin',
        'profiles_block_platform_admin_owner',
        'businesses_block_platform_admin_primary_owner'
      )
  ) then
    raise exception 'FAIL: siguen activos guards legacy que impiden separar rol global y rol tenant';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin_tenant_scope.sql · Caxas/Cajamarca + global admin scoped'
