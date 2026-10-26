-- BLOQUE 31 · contacto del negocio dentro del historial propio
\set ON_ERROR_STOP on
begin;

update public.businesses
set phone = '+51935059868',
    configuration_status = 'provisional'
where id = '10000000-0000-4000-8000-000000000001';

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values (
  '83100000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'customer-b31@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb
) on conflict (id) do nothing;

insert into public.user_accounts (user_id, role, display_name, is_active)
values ('83100000-0000-4000-8000-000000000001', 'customer', 'Cliente B31', true)
on conflict (user_id) do update set is_active = true;

insert into public.customers (id, business_id, full_name, phone_e164, user_id)
values (
  '83100000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000001',
  'Cliente B31', '+51911111831', '83100000-0000-4000-8000-000000000001'
);

insert into public.reservations (
  id, business_id, court_id, customer_id, user_id, start_at, end_at,
  status, lighting, hourly_rate, total_amount, source
) values (
  '83100000-0000-4000-8000-000000000201',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '83100000-0000-4000-8000-000000000101',
  '83100000-0000-4000-8000-000000000001',
  '2099-02-01 15:00+00', '2099-02-01 16:00+00',
  'confirmed', 'without_lights', 35, 35, 'public_web'
);

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.get_my_reservations()'::regprocedure) into definition;
  if definition not like '%auth.uid()%' or definition not like '%b.phone%' then
    raise exception 'FAIL: historial B31 debe derivar identidad y devolver teléfono del negocio';
  end if;
  if definition like '%configuration_status%' then
    raise exception 'FAIL: contacto de una reserva propia no debe depender de publicación actual';
  end if;
  if has_function_privilege('anon', 'public.get_my_reservations()', 'EXECUTE') then
    raise exception 'FAIL: anon no puede leer historial/contacto propio';
  end if;
  if not has_function_privilege('authenticated', 'public.get_my_reservations()', 'EXECUTE') then
    raise exception 'FAIL: authenticated necesita leer su historial/contacto';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '83100000-0000-4000-8000-000000000001', true);

do $$
declare
  own_phone text;
  public_rows integer;
begin
  select r.business_phone into own_phone
  from public.get_my_reservations() r
  where r.reservation_id = '83100000-0000-4000-8000-000000000201';

  if own_phone <> '+51935059868' then
    raise exception 'FAIL: historial propio debe conservar contacto del negocio: %', own_phone;
  end if;

  select count(*) into public_rows
  from public.get_public_business_config('valeibol-cajamarca');
  if public_rows <> 0 then
    raise exception 'FAIL: control del test: tenant provisional no debe aparecer en config pública';
  end if;
end $$;

rollback;
\echo 'PASS platform_customer_contact.sql · contacto propio aun con tenant no publicado'
