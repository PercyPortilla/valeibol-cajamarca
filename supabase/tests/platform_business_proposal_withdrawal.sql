-- Plataforma global · Bloque 45
\set ON_ERROR_STOP on
begin;

do $$
declare
  withdraw_fn text;
  expire_fn text;
  guard_fn text;
  notify_fn text;
  audit_fn text;
  respond_fn text;
begin
  select lower(pg_get_functiondef('public.admin_withdraw_business_reschedule_proposal(uuid,text)'::regprocedure)) into withdraw_fn;
  select lower(pg_get_functiondef('public.admin_expire_business_reschedule_proposal(uuid)'::regprocedure)) into expire_fn;
  select lower(pg_get_functiondef('public.block44_guard_business_proposal_resolution()'::regprocedure)) into guard_fn;
  select lower(pg_get_functiondef('public.block41_queue_change_request_notification()'::regprocedure)) into notify_fn;
  select lower(pg_get_functiondef('public.block42_audit_change_request()'::regprocedure)) into audit_fn;
  select lower(pg_get_functiondef('public.respond_to_business_reschedule_proposal(uuid,boolean)'::regprocedure)) into respond_fn;

  if withdraw_fn not like '%phase6_admin_actor()%'
     or withdraw_fn not like '%role not in (''owner'',''admin'')%'
     or withdraw_fn not like '%from public.reservations r%for update%from public.reservation_change_requests q%for update%'
     or withdraw_fn not like '%initiator_kind = ''business''%'
     or withdraw_fn not like '%resolution_kind = ''business_withdrawal''%'
     or withdraw_fn not like '%business_reschedule_proposal_expired_requires_expiration%'
     or withdraw_fn not like '%coalesce(v_request.requested_start_at, v_reservation.start_at) <= now()%'
     or withdraw_fn like '%update public.reservations%'
     or expire_fn not like '%phase6_admin_actor()%'
     or expire_fn not like '%resolution_kind = ''business_expiration''%'
     or expire_fn not like '%business_reschedule_proposal_not_expired%'
     or expire_fn not like '%from public.reservations r%for update%from public.reservation_change_requests q%for update%'
     or expire_fn like '%update public.reservations%'
     or guard_fn not like '%business_withdrawal%'
     or guard_fn not like '%customer_response%'
     or notify_fn not like '%reschedule_proposal_withdrawn%'
     or notify_fn not like '%reschedule_proposal_expired%'
     or audit_fn not like '%reschedule_proposal_withdrawn%'
     or audit_fn not like '%reschedule_proposal_expired%'
     or respond_fn not like '%v_request.resolution_kind = ''customer_response''%'
     or respond_fn not like '%change_request_already_resolved%'
  then
    raise exception 'FAIL: B45 withdrawal contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.admin_withdraw_business_reschedule_proposal(uuid,text)', 'EXECUTE') then
    raise exception 'FAIL: anon can withdraw B45 proposals';
  end if;
  if has_function_privilege('anon', 'public.admin_expire_business_reschedule_proposal(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can expire B45 proposals';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.reservation_change_requests'::regclass
      and c.conname = 'reservation_change_requests_resolution_kind_check'
  ) then
    raise exception 'FAIL: B45 resolution kind constraint missing';
  end if;
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.reservation_change_requests'::regclass
      and c.conname = 'reservation_change_requests_resolution_kind_check'
      and lower(pg_get_constraintdef(c.oid)) like '%status = ''pending''%'
      and lower(pg_get_constraintdef(c.oid)) like '%admin_resolution%'
      and lower(pg_get_constraintdef(c.oid)) like '%customer_response%'
      and lower(pg_get_constraintdef(c.oid)) like '%business_withdrawal%'
      and lower(pg_get_constraintdef(c.oid)) like '%business_expiration%'
  ) then
    raise exception 'FAIL: B45 resolution kind semantic constraint incomplete';
  end if;
end $$;

rollback;
\echo 'PASS platform_business_proposal_withdrawal.sql · business proposal withdrawal B45'
