-- Plataforma global · Bloque 54
\set ON_ERROR_STOP on
begin;

do $$
declare
  resolve_fn text;
  reservation_notify_trigger text;
  change_notify_fn text;
  expiration_notify_fn text;
begin
  select lower(pg_get_functiondef(
    'public.admin_resolve_reservation_change_request(uuid,boolean,text)'::regprocedure
  )) into resolve_fn;

  select lower(pg_get_triggerdef(t.oid)) into reservation_notify_trigger
  from pg_trigger t
  where t.tgname = 'reservations_block41_notification'
    and not t.tgisinternal;

  select lower(pg_get_functiondef(
    'public.block41_queue_change_request_notification()'::regprocedure
  )) into change_notify_fn;

  select lower(pg_get_functiondef(
    'public.block49_queue_pending_expiration_notification()'::regprocedure
  )) into expiration_notify_fn;

  if resolve_fn not like '%phase6_admin_actor()%'
     or resolve_fn not like '%request_type = ''cancellation''%'
     or resolve_fn not like '%closure_kind = ''confirmed_cancellation''%'
     or resolve_fn not like '%resolution_note is not distinct from v_note%'
     or resolve_fn not like '%v_reservation.closure_kind = ''confirmed_cancellation''%'
     or position('set status = ''cancelled''' in resolve_fn) = 0
     or position('set closure_kind = ''confirmed_cancellation''' in resolve_fn) <= position('set status = ''cancelled''' in resolve_fn)
  then
    raise exception 'FAIL: B54 cancellation closure contract incomplete';
  end if;

  if reservation_notify_trigger not like '%update of status, user_id%'
     or change_notify_fn not like '%cancellation_approved%'
     or expiration_notify_fn not like '%old.status = ''pending''%'
     or expiration_notify_fn not like '%new.closure_kind = ''request_expiration''%'
  then
    raise exception 'FAIL: B54 notification separation contract incomplete';
  end if;
end $$;

rollback;
\echo 'PASS platform_confirmed_cancellation_closure_consistency.sql · cierre confirmado B54'
