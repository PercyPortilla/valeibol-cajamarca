-- Valeibol · regla automática de iluminación + altura de red.
-- Requiere migración 202610150017_booking_rules_net_height.sql.
\set ON_ERROR_STOP on
begin;

-- B24: las reservas públicas requieren tenant publicado. Mantener este cambio
-- dentro de BEGIN/ROLLBACK conserva el seed provisional de desarrollo.
update public.businesses
set configuration_status = 'confirmed'
where slug = 'valeibol-cajamarca';

do $$
declare
  args text;
begin
  if to_regprocedure(
    'public.create_public_reservation_request(text,uuid,date,time,time,public.lighting_mode,text,text,boolean,uuid)'
  ) is not null then
    raise exception 'FAIL: la firma pública antigua todavía acepta lighting';
  end if;

  if to_regprocedure(
    'public.create_public_reservation_request(text,uuid,date,time,time,smallint,text,text,boolean,uuid)'
  ) is null then
    raise exception 'FAIL: falta la firma pública con net_height_cm';
  end if;

  select pg_get_function_arguments(
    'public.create_public_reservation_request(text,uuid,date,time,time,smallint,text,text,boolean,uuid)'::regprocedure
  ) into args;
  if args ~* 'lighting' then
    raise exception 'FAIL: lighting continúa siendo un input público: %', args;
  end if;
end $$;

do $$
begin
  if public.resolve_booking_lighting(time '07:00', time '08:00') <> 'without_lights' then
    raise exception 'FAIL: 07:00 debe usar tarifa sin luz';
  end if;
  if public.resolve_booking_lighting(time '17:00', time '18:00') <> 'without_lights' then
    raise exception 'FAIL: un intervalo que termina exactamente 18:00 debe quedar sin luz';
  end if;
  if public.resolve_booking_lighting(time '18:00', time '19:00') <> 'with_lights' then
    raise exception 'FAIL: 18:00 debe usar tarifa con luz';
  end if;

  begin
    perform public.resolve_booking_lighting(time '17:00', time '19:00');
    raise exception 'FAIL: se permitió cruzar el corte de las 18:00';
  exception when invalid_parameter_value then null;
  end;
end $$;

do $$
declare
  d date := current_date + 100;
  day_row record;
  night_row record;
begin
  set local role service_role;

  select * into day_row from public.create_public_reservation_request(
    'valeibol-cajamarca',
    '20000000-0000-4000-8000-000000000001',
    d,
    time '17:00',
    time '18:00',
    235::smallint,
    'Altura personalizada',
    '+51996000001',
    false,
    '91700000-0000-4000-8000-000000000001'
  );

  select * into night_row from public.create_public_reservation_request(
    'valeibol-cajamarca',
    '20000000-0000-4000-8000-000000000001',
    d,
    time '18:00',
    time '19:00',
    243::smallint,
    'Altura varones',
    '+51996000002',
    false,
    '91700000-0000-4000-8000-000000000002'
  );

  if day_row.lighting <> 'without_lights'
     or day_row.net_height_cm <> 235
     or day_row.hourly_rate <> 35 then
    raise exception 'FAIL: reserva diurna derivada incorrectamente: %', row_to_json(day_row);
  end if;

  if night_row.lighting <> 'with_lights'
     or night_row.net_height_cm <> 243
     or night_row.hourly_rate <> 60 then
    raise exception 'FAIL: reserva nocturna derivada incorrectamente: %', row_to_json(night_row);
  end if;

  begin
    perform * from public.create_public_reservation_request(
      'valeibol-cajamarca',
      '20000000-0000-4000-8000-000000000001',
      d + 1,
      time '16:00',
      time '17:00',
      179::smallint,
      'Altura inválida',
      '+51996000003',
      false,
      '91700000-0000-4000-8000-000000000003'
    );
    raise exception 'FAIL: se permitió una altura menor de 180 cm';
  exception when invalid_parameter_value then null;
  end;

  reset role;
end $$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.get_admin_export_reservations(date,date)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon puede ejecutar la exportación administrativa';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_public_reservation_request(text,uuid,date,time,time,smallint,text,text,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon puede saltarse el endpoint server-side';
  end if;
end $$;

rollback;
\echo 'PASS booking_rules_net_height.sql · iluminación automática/net height/export privileges'
