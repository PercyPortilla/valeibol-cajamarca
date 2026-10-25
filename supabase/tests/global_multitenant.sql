-- Plataforma global multi-cancha · Bloque 2
-- Ejecutar sobre base local reseteada. Todo se revierte al finalizar.
\set ON_ERROR_STOP on
begin;

-- B24: el catálogo público oculta tenants provisionales. Este test valida el
-- catálogo multi-tenant, por lo que publica Valeibol solo hasta el ROLLBACK.
update public.businesses
set configuration_status = 'confirmed'
where slug = 'valeibol-cajamarca';

do $$
declare
  labels text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder)
  into labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'platform_role';

  if labels is distinct from array['customer','owner','admin']::text[] then
    raise exception 'FAIL: platform_role inesperado: %', labels;
  end if;
end $$;

do $$
declare
  venue_business uuid;
  court_venue uuid;
  court_sport uuid;
begin
  select business_id into venue_business
  from public.venues
  where id = '30000000-0000-4000-8000-000000000001';

  select venue_id, sport_id into court_venue, court_sport
  from public.courts
  where id = '20000000-0000-4000-8000-000000000001';

  if venue_business is distinct from '10000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'FAIL: sede demo no pertenece a Valeibol';
  end if;
  if court_venue is distinct from '30000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'FAIL: cancha demo no está vinculada a la sede';
  end if;
  if court_sport is distinct from '60000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'FAIL: cancha demo no está vinculada a vóley';
  end if;
end $$;

do $$
declare
  payload jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into payload
  from public.get_public_platform_catalog('voley', 'Cajamarca') x;

  if jsonb_array_length(payload) < 1 then
    raise exception 'FAIL: catálogo público no devuelve Valeibol';
  end if;
  if payload::text ~* '(customer_phone|internal_note|created_by|user_id|email)' then
    raise exception 'FAIL: catálogo público expone datos privados: %', payload;
  end if;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.venues', 'SELECT') then
    raise exception 'FAIL: anon no debe leer venues directamente';
  end if;
  if has_table_privilege('anon', 'public.user_accounts', 'SELECT') then
    raise exception 'FAIL: anon no debe leer user_accounts';
  end if;
  if not has_table_privilege('anon', 'public.sports', 'SELECT') then
    raise exception 'FAIL: anon debe poder leer catálogo público de deportes';
  end if;
  if not has_function_privilege('anon', 'public.get_public_platform_catalog(text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon debe poder ejecutar catálogo sanitizado';
  end if;
end $$;

do $$
begin
  if has_table_privilege('authenticated', 'public.user_accounts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.user_accounts', 'INSERT')
     or has_table_privilege('authenticated', 'public.user_accounts', 'DELETE') then
    raise exception 'FAIL: authenticated no debe poder autoasignarse roles globales';
  end if;
end $$;

-- Aislamiento cross-tenant: un admin heredado de negocio A NO es admin global
-- y no puede ver/gestionar negocio B ni sus sedes mediante RLS.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'tenant-a-admin@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.businesses (id, slug, name, currency, timezone, is_active) values
  ('82000000-0000-4000-8000-000000000001', 'tenant-a-test', 'Tenant A', 'PEN', 'America/Lima', true),
  ('82000000-0000-4000-8000-000000000002', 'tenant-b-test', 'Tenant B', 'PEN', 'America/Lima', true)
on conflict (id) do nothing;

insert into public.venues (id, business_id, slug, name, is_active) values
  ('83000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'sede-a', 'Sede A', true),
  ('83000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000002', 'sede-b', 'Sede B', true)
on conflict (id) do nothing;

insert into public.profiles (user_id, business_id, role, display_name, is_active) values
  ('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001', 'admin', 'Admin Tenant A', true)
on conflict (user_id) do update set
  business_id = excluded.business_id,
  role = excluded.role,
  is_active = true;

do $$
declare
  global_role public.platform_role;
begin
  select role into global_role
  from public.user_accounts
  where user_id = '81000000-0000-4000-8000-000000000001';

  if global_role is distinct from 'customer'::public.platform_role then
    raise exception 'FAIL: admin heredado fue elevado a rol global %', global_role;
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);

do $$
declare
  foreign_venues integer;
begin
  if not public.can_view_business('82000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: admin heredado no puede ver su propio tenant';
  end if;
  if public.can_view_business('82000000-0000-4000-8000-000000000002') then
    raise exception 'FAIL: admin heredado obtuvo acceso cross-tenant';
  end if;
  if public.can_manage_business('82000000-0000-4000-8000-000000000002') then
    raise exception 'FAIL: admin heredado obtuvo gestión cross-tenant';
  end if;

  select count(*) into foreign_venues
  from public.venues
  where business_id = '82000000-0000-4000-8000-000000000002';
  if foreign_venues <> 0 then
    raise exception 'FAIL: RLS expuso sedes de otro tenant';
  end if;
end $$;

reset role;

rollback;
\echo 'PASS global_multitenant.sql · roles/sedes/deportes/RLS/catálogo'
