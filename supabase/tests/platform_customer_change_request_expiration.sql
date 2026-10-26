-- Plataforma global · Bloque 46
\set ON_ERROR_STOP on
begin;

do $$
declare
  expire_fn text;
  resolve_fn text;
  notify_fn text;
  audit_fn text;
begin
  select lower(pg_get_functiondef('public.admin_expire_customer_change_request(uuid)'::regprocedure)) into expire_fn;
  select lower(pg_get_functiondef('public.admin_resolve_reservation_change_request(uuid,boolean,text)'::regprocedure)) into resolve_fn;
  select lower(pg_get_functiondef('public.block41_queue_change_request_notification()'::regprocedure)) into notify_fn;
  select lower(pg_get_functiondef('public.block42_audit_change_request()'::regprocedure)) into audit_fn;

  if expire_fn not like '%phase6_admin_actor()%'
     or expire_fn not like '%role not in (''owner'',''admin'')%'
     or expire_fn not like '%from public.reservations r%for update%from public.reservation_change_requests q%for update%'
     or expire_fn not like '%initiator_kind = ''customer''%'
     or expire_fn not like '%resolution_kind = ''customer_expiration''%'
     or expire_fn like '%update public.reservations%'
     or resolve_fn not like '%customer_change_request_expired_requires_expiration%'
     or resolve_fn not like '%v_request.resolution_kind = ''admin_resolution''%'
     or notify_fn not like '%cancellation_expired%'
     or notify_fn not like '%reschedule_expired%'
     or audit_fn not like '%cancellation_expired%'
     or audit_fn not like '%reschedule_expired%'
  then
    raise exception 'FAIL: B46 expiration contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.admin_expire_customer_change_request(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can expire customer change requests';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.reservation_change_requests'::regclass
      and c.conname = 'reservation_change_requests_resolution_kind_check'
      and lower(pg_get_constraintdef(c.oid)) like '%customer_expiration%'
      and lower(pg_get_constraintdef(c.oid)) like '%admin_resolution%'
      and lower(pg_get_constraintdef(c.oid)) like '%business_expiration%'
  ) then
    raise exception 'FAIL: B46 resolution kind semantic constraint incomplete';
  end if;
end $$;

rollback;
\echo 'PASS platform_customer_change_request_expiration.sql · stale customer change request expiration B46'
