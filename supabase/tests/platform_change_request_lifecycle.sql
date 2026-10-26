-- Plataforma global · Bloque 43
\set ON_ERROR_STOP on
begin;

do $$
declare
  cancel_fn text;
  complete_fn text;
begin
  select lower(pg_get_functiondef('public.admin_cancel_reservation(uuid)'::regprocedure)) into cancel_fn;
  select lower(pg_get_functiondef('public.admin_complete_reservation(uuid)'::regprocedure)) into complete_fn;

  if cancel_fn not like '%from public.reservations r%for update%from public.reservation_change_requests q%for update%'
     or cancel_fn not like '%q.status = ''pending''%'
     or cancel_fn not like '%reservation_change_request_pending%'
     or complete_fn not like '%from public.reservations r%for update%from public.reservation_change_requests q%for update%'
     or complete_fn not like '%q.status = ''pending''%'
     or complete_fn not like '%reservation_change_request_pending%'
  then
    raise exception 'FAIL: B43 terminal transition guard/lock ordering incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.admin_cancel_reservation(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_complete_reservation(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute B43 admin lifecycle functions';
  end if;
end $$;

rollback;
\echo 'PASS platform_change_request_lifecycle.sql · terminal guards and lock ordering B43'

