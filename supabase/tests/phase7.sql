-- Valeibol · Fase 7 SQL tests
-- Requiere: supabase db reset
-- Ejecutar: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase7.sql
-- Todo se revierte al final.

\set ON_ERROR_STOP on
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('70000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-phase7@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('70000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin-phase7@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('70000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'staff-phase7@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('70000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'norole-phase7@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (user_id, business_id, role, display_name, is_active) values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'Owner phase7', true),
  ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'admin', 'Admin phase7', true),
  ('70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'staff', 'Staff phase7', true)
on conflict (user_id) do update set role = excluded.role, is_active = true;

-- 1) anon no puede leer PII ni ejecutar RPCs administrativas; sí puede consultar precios públicos sanitizados.
do $$
begin
  if has_table_privilege('anon', 'public.customers', 'SELECT')
     or has_table_privilege('anon', 'public.reservations', 'SELECT')
     or has_function_privilege('anon', 'public.get_admin_customers(integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_admin_operational_metrics(date,date)', 'EXECUTE') then
    raise exception 'FAIL: anon obtuvo acceso administrativo/PII';
  end if;
  if not has_function_privilege('anon', 'public.get_public_pricing_for_date(text,date)', 'EXECUTE') then
    raise exception 'FAIL: anon necesita la RPC pública sanitizada de precios';
  end if;
end $$;

-- 2) Superficie pública de precios expone S/35 y S/60 actuales sin PII.
do $$
declare
  d date := (now() at time zone 'America/Lima')::date;
  payload jsonb;
  rate35 numeric;
  rate60 numeric;
begin
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into payload
  from public.get_public_pricing_for_date('valeibol-cajamarca', d) x;
  if payload::text ~* '(customer|phone_e164|full_name|internal_notes|marketing_opt_in|reservation_id)' then
    raise exception 'FAIL: precios públicos exponen PII: %', payload;
  end if;
  select hourly_rate into rate35 from public.get_public_pricing_for_date('valeibol-cajamarca', d) where lighting='without_lights' limit 1;
  select hourly_rate into rate60 from public.get_public_pricing_for_date('valeibol-cajamarca', d) where lighting='with_lights' limit 1;
  if rate35 <> 35 or rate60 <> 60 then
    raise exception 'FAIL: tarifas actuales esperadas 35/60; obtuvo %/%', rate35, rate60;
  end if;
end $$;

-- 3) Owner crea una reserva con tarifa histórica, programa nueva tarifa futura y la reserva previa conserva su precio.
do $$
declare
  old_date date := (now() at time zone 'America/Lima')::date + 60;
  new_date date := (now() at time zone 'America/Lima')::date + 61;
  old_res record;
  new_rule record;
  new_res record;
  persisted_old numeric;
begin
  perform set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  select * into old_res from public.admin_create_manual_reservation(
    '20000000-0000-4000-8000-000000000001', old_date,
    time '08:00', time '09:00', 'without_lights', 'Histórico phase7', '+51997000001', 'admin'
  );
  select * into new_rule from public.admin_schedule_pricing_rule(
    '20000000-0000-4000-8000-000000000001', 'without_lights', 42, new_date
  );
  select * into new_res from public.admin_create_manual_reservation(
    '20000000-0000-4000-8000-000000000001', new_date,
    time '09:00', time '10:00', 'without_lights', 'Nueva tarifa phase7', '+51997000002', 'admin'
  );
  reset role;

  select hourly_rate into persisted_old from public.reservations where id = old_res.reservation_id;
  if old_res.hourly_rate <> 35 or persisted_old <> 35 then
    raise exception 'FAIL: reserva histórica fue reescrita tras cambio de precio';
  end if;
  if new_rule.hourly_rate <> 42 or new_res.hourly_rate <> 42 or new_res.total_amount <> 42 then
    raise exception 'FAIL: nueva reserva no usó tarifa futura autoritativa: % / %', row_to_json(new_rule), row_to_json(new_res);
  end if;
end $$;

-- 4) Staff puede leer precios/clientes/métricas pero no programar tarifa.
do $$
declare
  c_count integer;
begin
  perform set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000003', true);
  set local role authenticated;
  select count(*) into c_count from public.get_admin_customers(100);
  perform * from public.get_admin_pricing_rules();
  perform * from public.get_admin_operational_metrics(current_date, current_date + 90);
  begin
    perform * from public.admin_schedule_pricing_rule(
      '20000000-0000-4000-8000-000000000001', 'with_lights', 99, current_date + 90
    );
    raise exception 'FAIL: staff logró modificar precios';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- 5) Admin sí puede programar precio con negocio derivado del perfil; la firma no acepta business_id/total/status.
do $$
declare
  args text;
begin
  select pg_get_function_arguments('public.admin_schedule_pricing_rule(uuid,public.lighting_mode,numeric,date)'::regprocedure) into args;
  if args ~* '(business_id|total_amount|status)' then
    raise exception 'FAIL: RPC de precios acepta campo autoritativo manipulable: %', args;
  end if;
  perform set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000002', true);
  set local role authenticated;
  perform * from public.admin_schedule_pricing_rule(
    '20000000-0000-4000-8000-000000000001', 'with_lights', 65, current_date + 70
  );
  reset role;
end $$;

-- 6) Clientes y agregados provienen de reservas reales del negocio actual.
do $$
declare
  row1 record;
  hist_count integer;
begin
  perform set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  select * into row1 from public.get_admin_customers(200) where phone_e164 = '+51997000001';
  if row1.customer_id is null or row1.reservation_count < 1 then
    raise exception 'FAIL: cliente real no apareció con agregado de reservas';
  end if;
  select count(*) into hist_count from public.get_admin_customer_history(row1.customer_id, 100);
  if hist_count < 1 then
    raise exception 'FAIL: historial real del cliente no contiene su reserva';
  end if;
  reset role;
end $$;

-- 7) Aislamiento por business_id: un actor de Valeibol no recibe clientes de otro negocio.
do $$
declare
  other_business uuid := '71000000-0000-4000-8000-000000000001';
  leaked integer;
begin
  insert into public.businesses (id, slug, name, currency, timezone, configuration_status)
  values (other_business, 'otro-negocio-phase7', 'Otro negocio', 'PEN', 'America/Lima', 'confirmed');
  insert into public.customers (business_id, full_name, phone_e164)
  values (other_business, 'Cliente aislado', '+51997009999');

  perform set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  select count(*) into leaked from public.get_admin_customers(500) where phone_e164 = '+51997009999';
  reset role;
  if leaked <> 0 then
    raise exception 'FAIL: get_admin_customers filtró incorrectamente por negocio';
  end if;
end $$;

-- 8) Métricas distinguen estados y nunca se llaman pagos cobrados; valores son sumas de reservas.
do $$
declare
  m record;
  d1 date := (now() at time zone 'America/Lima')::date + 60;
  d2 date := (now() at time zone 'America/Lima')::date + 61;
begin
  perform set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  select * into m from public.get_admin_operational_metrics(d1, d2);
  reset role;

  if m.confirmed_count < 2 then
    raise exception 'FAIL: métricas no contaron reservas confirmadas creadas en test: %', row_to_json(m);
  end if;
  if m.reserved_hours <= 0 or m.confirmed_value <= 0 then
    raise exception 'FAIL: métricas de horas/valor incorrectas: %', row_to_json(m);
  end if;
  if m.timezone <> 'America/Lima' then
    raise exception 'FAIL: timezone operativo incorrecto: %', m.timezone;
  end if;
end $$;

-- 9) Usuario autenticado sin perfil válido no puede leer Clientes, Precios ni Métricas.
do $$
begin
  perform set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000004', true);
  set local role authenticated;
  begin perform * from public.get_admin_customers(10); raise exception 'FAIL: sin perfil leyó clientes'; exception when insufficient_privilege then null; end;
  begin perform * from public.get_admin_pricing_rules(); raise exception 'FAIL: sin perfil leyó precios'; exception when insufficient_privilege then null; end;
  begin perform * from public.get_admin_operational_metrics(current_date, current_date); raise exception 'FAIL: sin perfil leyó métricas'; exception when insufficient_privilege then null; end;
  reset role;
end $$;

rollback;
\echo 'PASS phase7.sql · clientes/precios/métricas/RLS/PII/versionado'
