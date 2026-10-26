-- Plataforma global · Bloque 39
\set ON_ERROR_STOP on
begin;

do $$
declare
  customer_fn text;
  admin_fn text;
  history_fn text;
begin
  select lower(pg_get_functiondef('public.request_my_reservation_cancellation(uuid,text)'::regprocedure)) into customer_fn;
  select lower(pg_get_functiondef('public.admin_resolve_reservation_change_request(uuid,boolean,text)'::regprocedure)) into admin_fn;
  select lower(pg_get_functiondef('public.get_my_reservations()'::regprocedure)) into history_fn;
  if customer_fn not like '%auth.uid()%'
     or customer_fn not like '%r.user_id = v_uid%'
     or customer_fn not like '%v_reservation.status <> ''confirmed''%'
     or admin_fn not like '%v_actor.role not in (''owner'',''admin'')%'
     or position('from public.reservations r' in admin_fn) > position('from public.reservation_change_requests q' in substring(admin_fn from position('for update' in admin_fn)))
     or admin_fn not like '%set status = ''cancelled''%'
     or history_fn not like '%can_request_cancellation%'
  then
    raise exception 'FAIL: B39 authorization/lifecycle contract incomplete';
  end if;
end $$;

rollback;
\echo 'PASS platform_confirmed_cancellation_requests.sql · confirmed cancellation workflow B39'

