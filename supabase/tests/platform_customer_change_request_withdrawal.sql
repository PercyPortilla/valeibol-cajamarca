-- Plataforma global · Bloque 47
\set ON_ERROR_STOP on
begin;

do $$
declare
  withdraw_fn text;
  list_fn text;
  notify_fn text;
  audit_fn text;
begin
  select lower(pg_get_functiondef('public.withdraw_my_reservation_change_request(uuid)'::regprocedure)) into withdraw_fn;
  select lower(pg_get_functiondef('public.get_my_reservation_change_requests()'::regprocedure)) into list_fn;
  select lower(pg_get_functiondef('public.block41_queue_change_request_notification()'::regprocedure)) into notify_fn;
  select lower(pg_get_functiondef('public.block42_audit_change_request()'::regprocedure)) into audit_fn;

  if withdraw_fn not like '%auth.uid()%'
     or withdraw_fn not like '%ua.user_id = v_uid%'
     or withdraw_fn not like '%ua.is_active%'
     or withdraw_fn not like '%q.user_id = v_uid%'
     or withdraw_fn not like '%initiator_kind = ''customer''%'
     or withdraw_fn not like '%from public.reservations r%for update%from public.reservation_change_requests q%for update%'
     or withdraw_fn not like '%resolution_kind = ''customer_withdrawal''%'
     or withdraw_fn not like '%customer_change_request_expired_requires_expiration%'
     or withdraw_fn not like '%v_reservation.start_at <= now()%'
     or withdraw_fn not like '%v_request.requested_start_at is null or v_request.requested_start_at <= now()%'
     or withdraw_fn like '%update public.reservations%'
     or list_fn not like '%can_withdraw_request%'
     or list_fn not like '%r.status = ''confirmed''%'
     or list_fn not like '%r.start_at > now()%'
     or list_fn not like '%q.requested_start_at is not null and q.requested_start_at > now()%'
     or notify_fn not like '%cancellation_withdrawn%'
     or notify_fn not like '%reschedule_withdrawn%'
     or audit_fn not like '%cancellation_withdrawn%'
     or audit_fn not like '%reschedule_withdrawn%'
     or audit_fn not like '%when new.resolution_kind = ''customer_withdrawal'' then ''customer''%'
  then
    raise exception 'FAIL: B47 customer withdrawal contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.withdraw_my_reservation_change_request(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can withdraw customer change requests';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.reservation_change_requests'::regclass
      and c.conname = 'reservation_change_requests_resolution_kind_check'
      and lower(pg_get_constraintdef(c.oid)) like '%customer_withdrawal%'
      and lower(pg_get_constraintdef(c.oid)) like '%customer_expiration%'
      and lower(pg_get_constraintdef(c.oid)) like '%admin_resolution%'
  ) then
    raise exception 'FAIL: B47 semantic resolution kind constraint incomplete';
  end if;
end $$;

rollback;
\echo 'PASS platform_customer_change_request_withdrawal.sql · customer self-withdrawal B47'
