-- Valeibol · Fase 4 SQL tests
-- Requiere una base local limpia: supabase db reset
-- Ejecutar: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase4.sql
-- Todo se revierte al final.

begin;

-- 1) Superficie pública mínima: RPC sí, tablas privadas no.
do $$
declare
  fn_oid oid;
begin
  if has_table_privilege('anon', 'public.customers', 'SELECT')
     or has_table_privilege('anon', 'public.customers', 'INSERT') then
    raise exception 'anon no debe leer/escribir customers directamente';
  end if;
  if has_table_privilege('anon', 'public.reservations', 'SELECT')
     or has_table_privilege('anon', 'public.reservations', 'INSERT') then
    raise exception 'anon no debe leer/escribir reservations directamente';
  end if;

  select p.oid into fn_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_public_reservation_request'
  limit 1;

  if fn_oid is null or not has_function_privilege('anon', fn_oid, 'EXECUTE') then
    raise exception 'anon debe poder ejecutar create_public_reservation_request';
  end if;
end;
$$;

-- 2) La RPC no acepta precio ni total aportados por navegador.
do $$
declare
  args text;
begin
  select pg_get_function_arguments(p.oid) into args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_public_reservation_request'
  limit 1;

  if args ~* '(hourly_rate|total_amount|price)' then
    raise exception 'La RPC pública no debe aceptar precio/total del cliente: %', args;
  end if;
end;
$$;

-- 3) Solicitud anónima real: debe funcionar mediante SECURITY DEFINER.
set local role anon;
select * from public.create_public_reservation_request(
  'valeibol-cajamarca',
  '20000000-0000-4000-8000-000000000001',
  current_date + 30,
  time '17:00', time '18:00',
  'without_lights',
  'Cliente test fase 4',
  '+51999999991',
  false,
  '40000000-0000-4000-8000-000000000091'
);
reset role;

-- 4) Tarifa y total se resuelven en servidor: S/35 y S/120.
do $$
declare
  row1 record;
  row2 record;
  test_date date := current_date + 30;
begin
  select * into row1 from public.create_public_reservation_request(
    'valeibol-cajamarca',
    '20000000-0000-4000-8000-000000000001',
    test_date,
    time '08:00', time '09:00',
    'without_lights', 'Tarifa sin luz', '+51999999992', false,
    '40000000-0000-4000-8000-000000000092'
  );
  if row1.request_status <> 'pending' or row1.hourly_rate <> 35 or row1.total_amount <> 35 then
    raise exception 'Tarifa sin luz incorrecta: %', row_to_json(row1);
  end if;

  select * into row2 from public.create_public_reservation_request(
    'valeibol-cajamarca',
    '20000000-0000-4000-8000-000000000001',
    test_date,
    time '09:00', time '11:00',
    'with_lights', 'Tarifa con luz', '+51999999993', false,
    '40000000-0000-4000-8000-000000000093'
  );
  if row2.request_status <> 'pending' or row2.hourly_rate <> 60 or row2.total_amount <> 120 then
    raise exception 'Tarifa con luz incorrecta: %', row_to_json(row2);
  end if;
end;
$$;

-- 5) Una pending bloquea inmediatamente la disponibilidad pública sin exponer PII.
do $$
declare
  payload jsonb;
  test_date date := current_date + 30;
begin
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into payload
  from public.get_public_availability('valeibol-cajamarca', test_date, test_date) x;

  if payload::text !~ 'reservation' then
    raise exception 'La solicitud pending debe aparecer como intervalo ocupado sanitizado';
  end if;
  if payload::text ~* '(customer|phone|full_name|internal_note|created_by|marketing)' then
    raise exception 'La disponibilidad pública expone PII: %', payload;
  end if;
end;
$$;

-- 6) El horario provisional está explícito y un día cerrado se rechaza en servidor.
do $$
declare
  closed_date date := current_date + 50;
  closed_weekday smallint := extract(isodow from (current_date + 50))::smallint;
begin
  if not exists (
    select 1 from public.operating_hours
    where court_id = '20000000-0000-4000-8000-000000000001'
      and configuration_status = 'provisional'
  ) then
    raise exception 'El horario de seed debe seguir marcado como provisional';
  end if;

  update public.operating_hours
  set is_open = false, opens_at = null, closes_at = null
  where court_id = '20000000-0000-4000-8000-000000000001'
    and weekday = closed_weekday;

  begin
    perform * from public.create_public_reservation_request(
      'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
      closed_date, time '12:00', time '13:00', 'without_lights',
      'Día cerrado', '+51999999997', false, '40000000-0000-4000-8000-000000000097'
    );
    raise exception 'ERROR: se permitió reservar un día cerrado';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- 7) Fechas pasadas, intervalos fuera de horario e incrementos inválidos se rechazan.
do $$
begin
  begin
    perform * from public.create_public_reservation_request(
      'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
      current_date - 1, time '12:00', time '13:00', 'without_lights',
      'Pasado', '+51999999994', false, '40000000-0000-4000-8000-000000000094'
    );
    raise exception 'ERROR: se permitió una solicitud en el pasado';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform * from public.create_public_reservation_request(
      'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
      current_date + 30, time '07:00', time '08:00', 'without_lights',
      'Fuera de horario', '+51999999995', false, '40000000-0000-4000-8000-000000000095'
    );
    raise exception 'ERROR: se permitió una solicitud fuera de operación';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform * from public.create_public_reservation_request(
      'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
      current_date + 30, time '11:30', time '12:30', 'without_lights',
      'Incremento inválido', '+51999999996', false, '40000000-0000-4000-8000-000000000096'
    );
    raise exception 'ERROR: se permitió un inicio fuera del incremento de 60 min';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- 8) Solapamientos parciales/totales fallan; límites contiguos [inicio, fin) se permiten.
do $$
declare
  test_date date := current_date + 31;
begin
  perform * from public.create_public_reservation_request(
    'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
    test_date, time '12:00', time '14:00', 'with_lights',
    'Base solape', '+51999999971', false, '40000000-0000-4000-8000-000000000071'
  );

  begin
    perform * from public.create_public_reservation_request(
      'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
      test_date, time '13:00', time '14:00', 'without_lights',
      'Parcial', '+51999999972', false, '40000000-0000-4000-8000-000000000072'
    );
    raise exception 'ERROR: se permitió solapamiento parcial';
  exception when exclusion_violation then null;
  end;

  begin
    perform * from public.create_public_reservation_request(
      'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
      test_date, time '12:00', time '14:00', 'without_lights',
      'Total', '+51999999973', false, '40000000-0000-4000-8000-000000000073'
    );
    raise exception 'ERROR: se permitió solapamiento total';
  exception when exclusion_violation then null;
  end;

  -- Contiguo a la derecha: permitido.
  perform * from public.create_public_reservation_request(
    'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
    test_date, time '14:00', time '15:00', 'without_lights',
    'Contiguo', '+51999999974', false, '40000000-0000-4000-8000-000000000074'
  );
end;
$$;

-- 9) Idempotencia: repetir el mismo request_token no crea otra reserva.
do $$
declare
  first_id uuid;
  second_id uuid;
  before_count integer;
  after_count integer;
  token uuid := '40000000-0000-4000-8000-000000000081';
  test_date date := current_date + 32;
begin
  select count(*) into before_count from public.reservations;

  select request_id into first_id from public.create_public_reservation_request(
    'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
    test_date, time '15:00', time '16:00', 'without_lights',
    'Idempotente', '+51999999981', false, token
  );
  select request_id into second_id from public.create_public_reservation_request(
    'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
    test_date, time '15:00', time '16:00', 'without_lights',
    'Idempotente', '+51999999981', false, token
  );

  select count(*) into after_count from public.reservations;
  if first_id is distinct from second_id or after_count <> before_count + 1 then
    raise exception 'Idempotencia falló: %, %, % -> %', first_id, second_id, before_count, after_count;
  end if;
end;
$$;

rollback;
