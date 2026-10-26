-- Plataforma global · Bloque 40
\set ON_ERROR_STOP on
begin;

do $$
declare
  customer_fn text;
  admin_fn text;
  legacy_edit text;
begin
  select lower(pg_get_functiondef('public.request_my_reservation_reschedule(uuid,uuid,date,time,time,text)'::regprocedure)) into customer_fn;
  select lower(pg_get_functiondef('public.admin_resolve_reservation_change_request(uuid,boolean,text)'::regprocedure)) into admin_fn;
  select lower(pg_get_functiondef('public.admin_edit_reservation(uuid,uuid,date,time,time,public.lighting_mode,text,text)'::regprocedure)) into legacy_edit;
  if customer_fn not like '%auth.uid()%'
     or customer_fn not like '%phase6_resolve_window%'
     or customer_fn not like '%resolve_booking_lighting%'
     or customer_fn not like '%pg_advisory_xact_lock%'
     or customer_fn not like '%court_schedule_entries%'
     or customer_fn not like '%reservation_payment_requires_business_reschedule%'
     or admin_fn not like '%requested_court_id%'
     or admin_fn not like '%reschedule_quote_changed%'
     or admin_fn not like '%exception when exclusion_violation%'
     or legacy_edit not like '%confirmed_reschedule_requires_request%'
  then
    raise exception 'FAIL: B40 reschedule contract incomplete';
  end if;
end $$;

rollback;
\echo 'PASS platform_confirmed_reschedule_requests.sql · confirmed reschedule workflow B40'

