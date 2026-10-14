-- Valeibol · Fase 6 SQL tests
-- Requiere: supabase db reset
-- Ejecutar: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase6.sql
-- Todo se revierte al final.

\set ON_ERROR_STOP on
begin;

-- Usuarios administrativos de prueba. No son datos reales y se revierten.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('60000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-phase6@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin-phase6@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'staff-phase6@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'norole-phase6@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (user_id, business_id, role, display_name, is_active) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'Owner test', true),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'admin', 'Admin test', true),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'staff', 'Staff test', true)
on conflict (user_id) do update set role = excluded.role, is_active = true;

-- 1) Superficie de privilegios: anon jamás opera; authenticated solo RPCs específicas y no CRUD genérico.
do $$
begin
  if has_function_privilege('anon', 'public.admin_confirm_reservation(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_cancel_reservation(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_admin_schedule(date,date)', 'EXECUTE') then
    raise exception 'FAIL: anon no debe ejecutar funciones administrativas de Fase 6';
  end if;

  if not has_function_privilege('authenticated', 'public.admin_confirm_reservation(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_create_manual_reservation(uuid,date,time without time zone,time without time zone,public.lighting_mode,text,text,public.reservation_source)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_create_schedule_block(uuid,date,time without time zone,time without time zone,public.block_reason,text)', 'EXECUTE') then
    raise exception 'FAIL: authenticated autorizado necesita RPCs operativas';
  end if;

  if has_table_privilege('authenticated', 'public.reservations', 'INSERT')
     or has_table_privilege('authenticated', 'public.reservations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.reservations', 'DELETE')
     or has_table_privilege('authenticated', 'public.schedule_blocks', 'INSERT')
     or has_table_privilege('authenticated', 'public.schedule_blocks', 'UPDATE') then
    raise exception 'FAIL: Fase 6 no debe reabrir CRUD genérico';
  end if;
end $$;

-- 2) Las RPCs de mutación no aceptan business_id, precio, total ni status controlado por navegador.
do $$
declare
  args text;
begin
  select pg_get_function_arguments('public.admin_create_manual_reservation(uuid,date,time without time zone,time without time zone,public.lighting_mode,text,text,public.reservation_source)'::regprocedure)
    into args;
  if args ~* '(business_id|hourly_rate|total_amount|status)' then
    raise exception 'FAIL: create manual acepta campo autoritativo manipulable: %', args;
  end if;

  select pg_get_function_arguments('public.admin_confirm_reservation(uuid)'::regprocedure) into args;
  if args ~* '(business_id|status)' then
    raise exception 'FAIL: confirmar no debe aceptar negocio/estado desde cliente: %', args;
  end if;
end $$;

-- 3) Crear pending pública base, confirmar owner y comprobar que NO se duplica el ledger.
do $$
declare
  test_date date := current_date + 40;
  rid uuid;
  ledger_count integer;
  row1 record;
begin
  select request_id into rid from public.create_public_reservation_request(
    'valeibol-cajamarca',
    '20000000-0000-4000-8000-000000000001',
    test_date, time '18:00', time '19:00', 'without_lights',
    'Cliente test phase6', '+51999000001', false,
    '61000000-0000-4000-8000-000000000001'
  );

  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  select * into row1 from public.admin_confirm_reservation(rid);
  reset role;

  if row1.reservation_status <> 'confirmed' then
    raise exception 'FAIL: pending no pasó a confirmed';
  end if;

  select count(*) into ledger_count
  from public.court_schedule_entries
  where source_kind = 'reservation' and source_id = rid and blocks_availability;
  if ledger_count <> 1 then
    raise exception 'FAIL: confirmar debe conservar exactamente una ocupación, obtuvo %', ledger_count;
  end if;

  -- Idempotencia: confirmar de nuevo no crea otra ocupación.
  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  perform * from public.admin_confirm_reservation(rid);
  reset role;

  select count(*) into ledger_count
  from public.court_schedule_entries
  where source_kind = 'reservation' and source_id = rid and blocks_availability;
  if ledger_count <> 1 then
    raise exception 'FAIL: confirmación idempotente duplicó ledger';
  end if;
end $$;

-- 4) Cancelar confirmed libera el horario y repetir cancelación es idempotente.
do $$
declare
  test_date date := current_date + 41;
  rid uuid;
  row1 record;
begin
  select request_id into rid from public.create_public_reservation_request(
    'valeibol-cajamarca', '20000000-0000-4000-8000-000000000001',
    test_date, time '19:00', time '20:00', 'with_lights',
    'Cancel test', '+51999000002', false,
    '61000000-0000-4000-8000-000000000002'
  );

  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000002', true);
  set local role authenticated;
  perform * from public.admin_confirm_reservation(rid);
  select * into row1 from public.admin_cancel_reservation(rid);
  perform * from public.admin_cancel_reservation(rid);
  reset role;

  if row1.reservation_status <> 'cancelled' then
    raise exception 'FAIL: confirmed no pasó a cancelled';
  end if;
  if exists (
    select 1 from public.court_schedule_entries
    where source_kind='reservation' and source_id=rid and blocks_availability
  ) then
    raise exception 'FAIL: cancelar debe liberar la ocupación';
  end if;
end $$;

-- 5) Reserva manual autoritativa: S/35 y S/60; status confirmed; actor registrado.
do $$
declare
  d date := current_date + 42;
  r35 record;
  r60 record;
begin
  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000003', true);
  set local role authenticated;
  select * into r35 from public.admin_create_manual_reservation(
    '20000000-0000-4000-8000-000000000001', d,
    time '08:00', time '09:00', 'without_lights',
    'Manual 35', '+51999000003', 'phone'
  );
  select * into r60 from public.admin_create_manual_reservation(
    '20000000-0000-4000-8000-000000000001', d,
    time '09:00', time '11:00', 'with_lights',
    'Manual 120', '+51999000004', 'whatsapp'
  );
  reset role;

  if r35.reservation_status <> 'confirmed' or r35.hourly_rate <> 35 or r35.total_amount <> 35 then
    raise exception 'FAIL: reserva manual sin luz incorrecta: %', row_to_json(r35);
  end if;
  if r60.reservation_status <> 'confirmed' or r60.hourly_rate <> 60 or r60.total_amount <> 120 then
    raise exception 'FAIL: reserva manual con luz incorrecta: %', row_to_json(r60);
  end if;
  if not exists (
    select 1 from public.reservations
    where id = r35.reservation_id
      and created_by = '60000000-0000-4000-8000-000000000003'
      and last_modified_by = '60000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'FAIL: falta trazabilidad del actor en reserva manual';
  end if;
end $$;

-- 6) Staff puede operar confirm/cancel/manual/bloqueo pero NO editar una reserva existente.
do $$
declare
  d date := current_date + 43;
  r record;
begin
  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000003', true);
  set local role authenticated;
  select * into r from public.admin_create_manual_reservation(
    '20000000-0000-4000-8000-000000000001', d,
    time '12:00', time '13:00', 'without_lights',
    'Staff original', '+51999000005', 'admin'
  );
  begin
    perform * from public.admin_edit_reservation(
      r.reservation_id,
      '20000000-0000-4000-8000-000000000001', d,
      time '13:00', time '14:00', 'with_lights',
      'Staff edit', '+51999000005'
    );
    raise exception 'FAIL: staff logró editar reserva';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- 7) Owner sí puede editar y el servidor recalcula la tarifa/total.
do $$
declare
  d date := current_date + 44;
  r record;
  edited record;
begin
  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  select * into r from public.admin_create_manual_reservation(
    '20000000-0000-4000-8000-000000000001', d,
    time '10:00', time '11:00', 'without_lights',
    'Edit owner', '+51999000006', 'admin'
  );
  select * into edited from public.admin_edit_reservation(
    r.reservation_id,
    '20000000-0000-4000-8000-000000000001', d,
    time '10:00', time '12:00', 'with_lights',
    'Edit owner actualizado', '+51999000006'
  );
  reset role;

  if edited.hourly_rate <> 60 or edited.total_amount <> 120 then
    raise exception 'FAIL: edición no recalculó tarifa autoritativa: %', row_to_json(edited);
  end if;
end $$;

-- 8) Bloquear/desbloquear: activo ocupa; cancelled libera; razón y actor quedan trazados.
do $$
declare
  d date := current_date + 45;
  b record;
  unblocked record;
begin
  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000003', true);
  set local role authenticated;
  select * into b from public.admin_create_schedule_block(
    '20000000-0000-4000-8000-000000000001', d,
    time '16:00', time '18:00', 'maintenance', 'Mantenimiento test'
  );
  reset role;

  if b.block_status <> 'active' or not exists (
    select 1 from public.court_schedule_entries
    where source_kind='block' and source_id=b.block_id and blocks_availability
  ) then
    raise exception 'FAIL: bloqueo activo no ocupa ledger';
  end if;

  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000003', true);
  set local role authenticated;
  select * into unblocked from public.admin_cancel_schedule_block(b.block_id);
  perform * from public.admin_cancel_schedule_block(b.block_id);
  reset role;

  if unblocked.block_status <> 'cancelled' or exists (
    select 1 from public.court_schedule_entries
    where source_kind='block' and source_id=b.block_id and blocks_availability
  ) then
    raise exception 'FAIL: desbloqueo no liberó ledger';
  end if;
end $$;

-- 9) Solapamientos parciales/totales fallan y límites contiguos [inicio,fin) se permiten.
do $$
declare
  d date := current_date + 46;
begin
  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000002', true);
  set local role authenticated;
  perform * from public.admin_create_manual_reservation(
    '20000000-0000-4000-8000-000000000001', d,
    time '12:00', time '14:00', 'without_lights', 'Base conflicto', '+51999000007', 'admin'
  );

  begin
    perform * from public.admin_create_schedule_block(
      '20000000-0000-4000-8000-000000000001', d,
      time '13:00', time '14:00', 'event', null
    );
    raise exception 'FAIL: bloqueo parcial solapado fue permitido';
  exception when exclusion_violation then null;
  end;

  begin
    perform * from public.admin_create_manual_reservation(
      '20000000-0000-4000-8000-000000000001', d,
      time '12:00', time '14:00', 'with_lights', 'Total conflicto', '+51999000008', 'admin'
    );
    raise exception 'FAIL: reserva total solapada fue permitida';
  exception when exclusion_violation then null;
  end;

  -- Contiguo a la derecha: permitido.
  perform * from public.admin_create_schedule_block(
    '20000000-0000-4000-8000-000000000001', d,
    time '14:00', time '15:00', 'event', null
  );
  reset role;
end $$;

-- 10) Usuario autenticado sin perfil válido no puede leer ni mutar agenda.
do $$
begin
  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000004', true);
  set local role authenticated;
  begin
    perform * from public.get_admin_schedule(current_date + 1, current_date + 7);
    raise exception 'FAIL: usuario sin perfil leyó pizarra';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.admin_create_schedule_block(
      '20000000-0000-4000-8000-000000000001', current_date + 60,
      time '10:00', time '11:00', 'other', null
    );
    raise exception 'FAIL: usuario sin perfil mutó agenda';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- 11) La pizarra privada contiene PII para operador; la superficie pública jamás la devuelve.
do $$
declare
  private_payload jsonb;
  public_payload jsonb;
  d date := current_date + 42;
begin
  perform set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
  set local role authenticated;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into private_payload
  from public.get_admin_schedule(d, d) x;
  reset role;

  if private_payload::text !~* 'Manual 35' or private_payload::text !~ '\+51999000003' then
    raise exception 'FAIL: pizarra admin no incluyó PII mínima esperada';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into public_payload
  from public.get_public_availability('valeibol-cajamarca', d, d) x;

  if public_payload::text ~* '(Manual 35|51999000003|customerName|phone|full_name|internal_note)' then
    raise exception 'FAIL: superficie pública expone PII: %', public_payload;
  end if;
end $$;


-- 12) La señal Realtime pública es legible pero no contiene PII/horarios/estados.
do $$
declare
  payload jsonb;
begin
  set local role anon;
  select coalesce(jsonb_agg(to_jsonb(ar)), '[]'::jsonb)
  into payload
  from public.availability_revisions ar;
  reset role;

  if payload::text ~* '(customer|phone|full_name|internal_note|start_at|end_at|status|lighting|total_amount)' then
    raise exception 'FAIL: availability_revisions expone datos no sanitizados: %', payload;
  end if;
end $$;

rollback;
\echo 'PASS phase6.sql · operaciones/RLS/transiciones/agenda/PII'
