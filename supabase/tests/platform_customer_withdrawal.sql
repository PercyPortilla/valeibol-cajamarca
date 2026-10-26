-- BLOQUE 30 · retiro propio de solicitudes pendientes
\set ON_ERROR_STOP on
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('83000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'customer-b30@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('83000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'other-b30@example.test', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.user_accounts (user_id, role, display_name, is_active) values
  ('83000000-0000-4000-8000-000000000001', 'customer', 'Cliente B30', true),
  ('83000000-0000-4000-8000-000000000002', 'customer', 'Otro B30', true)
on conflict (user_id) do update set is_active = true;

insert into public.customers (id, business_id, full_name, phone_e164, user_id) values
  ('83000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'Cliente B30', '+51911111830', '83000000-0000-4000-8000-000000000001'),
  ('83000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', 'Otro B30', '+51911112830', '83000000-0000-4000-8000-000000000002');

insert into public.reservations (
  id, business_id, court_id, customer_id, user_id, start_at, end_at,
  status, lighting, hourly_rate, total_amount, source
) values
  ('83000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', '2099-01-01 15:00+00', '2099-01-01 16:00+00', 'pending', 'without_lights', 35, 35, 'public_web'),
  ('83000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', '2099-01-02 15:00+00', '2099-01-02 16:00+00', 'confirmed', 'without_lights', 35, 35, 'public_web'),
  ('83000000-0000-4000-8000-000000000203', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', '2000-01-01 15:00+00', '2000-01-01 16:00+00', 'pending', 'without_lights', 35, 35, 'public_web'),
  ('83000000-0000-4000-8000-000000000204', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', '2099-01-03 15:00+00', '2099-01-03 16:00+00', 'pending', 'without_lights', 35, 35, 'public_web'),
  ('83000000-0000-4000-8000-000000000205', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000102', '83000000-0000-4000-8000-000000000002', '2099-01-04 15:00+00', '2099-01-04 16:00+00', 'pending', 'without_lights', 35, 35, 'public_web'),
  ('83000000-0000-4000-8000-000000000206', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', '2099-01-05 15:00+00', '2099-01-05 16:00+00', 'pending', 'without_lights', 35, 35, 'public_web'),
  ('83000000-0000-4000-8000-000000000207', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', '2099-01-06 15:00+00', '2099-01-06 16:00+00', 'pending', 'without_lights', 35, 35, 'public_web'),
  ('83000000-0000-4000-8000-000000000208', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', '2099-01-07 15:00+00', '2099-01-07 16:00+00', 'pending', 'without_lights', 35, 35, 'public_web'),
  ('83000000-0000-4000-8000-000000000209', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000101', '83000000-0000-4000-8000-000000000001', '2099-01-08 15:00+00', '2099-01-08 16:00+00', 'pending', 'without_lights', 35, 35, 'admin');

insert into public.reservation_payments (
  id, business_id, reservation_id, user_id, method, status, amount, currency,
  customer_reference, reviewed_at
) values
  ('83000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000204', '83000000-0000-4000-8000-000000000001', 'yape', 'reported', 35, 'PEN', 'B30-REPORTED', null),
  ('83000000-0000-4000-8000-000000000302', '10000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000206', '83000000-0000-4000-8000-000000000001', 'plin', 'verified', 35, 'PEN', 'B30-VERIFIED', now()),
  ('83000000-0000-4000-8000-000000000303', '10000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000207', '83000000-0000-4000-8000-000000000001', 'yape', 'rejected', 35, 'PEN', 'B30-REJECTED', now()),
  ('83000000-0000-4000-8000-000000000304', '10000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000208', '83000000-0000-4000-8000-000000000001', 'cash', 'refunded', 35, 'PEN', 'B30-REFUNDED', now());

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.withdraw_my_pending_reservation(uuid)'::regprocedure) into definition;
  if has_function_privilege('anon', 'public.withdraw_my_pending_reservation(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon no puede retirar solicitudes';
  end if;
  if not has_function_privilege('authenticated', 'public.withdraw_my_pending_reservation(uuid)', 'EXECUTE') then
    raise exception 'FAIL: authenticated necesita ejecutar retiro propio';
  end if;
  if definition not like '%auth.uid()%' or definition not like '%for update%' then
    raise exception 'FAIL: retiro debe derivar auth.uid y bloquear la reserva';
  end if;
  if definition not like '%reported%' or definition not like '%verified%' then
    raise exception 'FAIL: retiro debe proteger pagos abiertos';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000001', true);

do $$
declare
  can_withdraw_reported boolean;
  can_withdraw_rejected boolean;
  can_withdraw_manual boolean;
begin
  select r.can_withdraw into can_withdraw_reported
  from public.get_my_reservations() r
  where r.reservation_id = '83000000-0000-4000-8000-000000000204';
  if coalesce(can_withdraw_reported, true) then
    raise exception 'FAIL: can_withdraw debe ocultar retiro con pago reported';
  end if;

  select r.can_withdraw into can_withdraw_rejected
  from public.get_my_reservations() r
  where r.reservation_id = '83000000-0000-4000-8000-000000000207';
  if not coalesce(can_withdraw_rejected, false) then
    raise exception 'FAIL: pago rejected no debe ocultar retiro de pending pública futura';
  end if;

  select r.can_withdraw into can_withdraw_manual
  from public.get_my_reservations() r
  where r.reservation_id = '83000000-0000-4000-8000-000000000209';
  if coalesce(can_withdraw_manual, true) then
    raise exception 'FAIL: can_withdraw solo aplica a source public_web';
  end if;
end $$;

do $$
declare
  withdrawn_status public.reservation_status;
  still_blocks boolean;
begin
  select reservation_status into withdrawn_status
  from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000201');
  if withdrawn_status <> 'cancelled' then
    raise exception 'FAIL: pending propia futura debe quedar cancelled';
  end if;

  select e.blocks_availability into still_blocks
  from public.court_schedule_entries e
  where e.source_kind = 'reservation'
    and e.source_id = '83000000-0000-4000-8000-000000000201';
  if coalesce(still_blocks, true) then
    raise exception 'FAIL: retiro debe liberar disponibilidad vía trigger';
  end if;

  select reservation_status into withdrawn_status
  from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000201');
  if withdrawn_status <> 'cancelled' then
    raise exception 'FAIL: retiro repetido debe ser idempotente';
  end if;
end $$;

do $$
begin
  begin
    perform * from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000202');
    raise exception 'FAIL: confirmed no debe retirarse';
  exception when others then
    if sqlerrm not like '%reservation_not_withdrawable%' then raise; end if;
  end;

  begin
    perform * from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000203');
    raise exception 'FAIL: pending pasada no debe retirarse';
  exception when others then
    if sqlerrm not like '%reservation_withdrawal_window_closed%' then raise; end if;
  end;

  begin
    perform * from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000204');
    raise exception 'FAIL: pago reported debe bloquear retiro';
  exception when others then
    if sqlerrm not like '%reservation_payment_requires_business_cancellation%' then raise; end if;
  end;

  begin
    perform * from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000206');
    raise exception 'FAIL: pago verified debe bloquear retiro';
  exception when others then
    if sqlerrm not like '%reservation_payment_requires_business_cancellation%' then raise; end if;
  end;

  perform * from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000207');
  if (select status from public.reservations where id = '83000000-0000-4000-8000-000000000207') <> 'cancelled' then
    raise exception 'FAIL: pago rejected no debe bloquear retiro';
  end if;

  perform * from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000208');
  if (select status from public.reservations where id = '83000000-0000-4000-8000-000000000208') <> 'cancelled' then
    raise exception 'FAIL: pago refunded no debe bloquear retiro';
  end if;

  begin
    perform * from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000209');
    raise exception 'FAIL: source no pública no debe retirarse por autoservicio';
  exception when others then
    if sqlerrm not like '%reservation_not_withdrawable%' then raise; end if;
  end;

  begin
    perform * from public.withdraw_my_pending_reservation('83000000-0000-4000-8000-000000000205');
    raise exception 'FAIL: usuario no debe retirar reserva ajena';
  exception when others then
    if sqlerrm not like '%reservation_not_found%' then raise; end if;
  end;
end $$;

rollback;
\echo 'PASS platform_customer_withdrawal.sql · ownership/pending/futuro/source/pagos/idempotencia/agenda'
