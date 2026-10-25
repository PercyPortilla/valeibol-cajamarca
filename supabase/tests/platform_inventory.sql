-- Plataforma global · Bloque 20
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.platform_admin_create_business(text,text,text,text,text,text,text,text,text)'::regprocedure) into definition;
  if definition not like '%public.is_platform_admin()%' then
    raise exception 'FAIL: alta de tenant no valida ADMIN global';
  end if;
  if definition not like '%from auth.users%' or definition not like '%insert into public.profiles%' then
    raise exception 'FAIL: alta no bootstrappea owner existente de forma autoritativa';
  end if;
  if has_function_privilege('anon', 'public.platform_admin_create_business(text,text,text,text,text,text,text,text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon no debe crear tenants';
  end if;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.can_view_business(uuid)'::regprocedure) into definition;
  if definition not like '%b.is_active%' or definition not like '%p.is_active%' or definition like '%owner_user_id = (select auth.uid())%' then
    raise exception 'FAIL: can_view_business permite bypass de revocación/suspensión';
  end if;

  select pg_get_functiondef('public.can_manage_business(uuid)'::regprocedure) into definition;
  if definition not like '%b.is_active%' or definition not like '%p.is_active%' or definition like '%owner_user_id = (select auth.uid())%' then
    raise exception 'FAIL: can_manage_business permite bypass de revocación/suspensión';
  end if;

  select pg_get_functiondef('public.admin_access_update_profile(uuid,uuid,public.app_role,text,boolean,boolean)'::regprocedure) into definition;
  if definition not like '%primary_owner_transfer_required%' then
    raise exception 'FAIL: owner principal puede degradarse sin transferencia';
  end if;

  select pg_get_functiondef('public.platform_admin_set_business_active(uuid,boolean)'::regprocedure) into definition;
  if definition not like '%business_has_future_reservations%' then
    raise exception 'FAIL: suspensión de tenant no protege reservas futuras';
  end if;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.admin_create_court(uuid,uuid,text,text,text,jsonb,numeric,numeric)'::regprocedure) into definition;
  if definition not like '%phase6_admin_actor()%' or definition like '%p_business_id%' then
    raise exception 'FAIL: alta de cancha debe derivar tenant de auth';
  end if;
  if definition not like '%insert into public.operating_hours%' or definition not like '%insert into public.pricing_rules%' then
    raise exception 'FAIL: alta de cancha no es operativa/atómica';
  end if;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.admin_set_court_active(uuid,boolean)'::regprocedure) into definition;
  if definition not like '%court_has_future_reservations%' or definition not like '%r.status in (''pending'', ''confirmed'')%' then
    raise exception 'FAIL: desactivación no protege reservas futuras';
  end if;
end $$;

rollback;
\echo 'PASS platform_inventory.sql · onboarding/inventory/guards B20'
