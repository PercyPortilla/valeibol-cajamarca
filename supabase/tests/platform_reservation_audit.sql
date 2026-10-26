-- Plataforma global · Bloque 42
\set ON_ERROR_STOP on
begin;

do $$
declare
  reader text;
  reservation_trigger text;
  change_trigger text;
begin
  select lower(pg_get_functiondef('public.get_admin_reservation_audit(uuid,integer)'::regprocedure)) into reader;
  select lower(pg_get_functiondef('public.block42_audit_reservation()'::regprocedure)) into reservation_trigger;
  select lower(pg_get_functiondef('public.block42_audit_change_request()'::regprocedure)) into change_trigger;

  if reader not like '%phase6_admin_actor()%'
     or reader not like '%e.business_id = v_actor.business_id%'
     or reader like '%email%'
     or reader like '%phone%'
     or reservation_trigger not like '%reservation_rescheduled%'
     or reservation_trigger not like '%reservation_account_linked%'
     or change_trigger not like '%cancellation_requested%'
     or change_trigger not like '%reschedule_approved%'
  then
    raise exception 'FAIL: B42 audit scope/event/privacy contract incomplete';
  end if;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.reservation_audit_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.reservation_audit_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.reservation_audit_events', 'INSERT')
     or has_table_privilege('authenticated', 'public.reservation_audit_events', 'UPDATE')
     or has_table_privilege('authenticated', 'public.reservation_audit_events', 'DELETE') then
    raise exception 'FAIL: B42 audit table exposed directly';
  end if;
  if has_function_privilege('authenticated', 'public.block42_actor_kind(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.block42_audit_reservation()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.block42_audit_change_request()', 'EXECUTE') then
    raise exception 'FAIL: B42 internal functions exposed';
  end if;
  if has_function_privilege('authenticated', 'public.block42_reject_audit_mutation()', 'EXECUTE') then
    raise exception 'FAIL: B42 append-only guard exposed';
  end if;
end $$;

do $$
declare
  guard text;
begin
  select lower(pg_get_functiondef('public.block42_reject_audit_mutation()'::regprocedure)) into guard;
  if guard not like '%reservation_audit_is_append_only%'
     or guard not like '%tg_op = ''delete'' and not exists%from public.businesses%'
     or not exists (
       select 1 from pg_trigger
       where tgname = 'reservation_audit_events_append_only'
         and not tgisinternal
     ) then
    raise exception 'FAIL: B42 audit log is not physically append-only';
  end if;
end $$;

do $$
declare
  reservation_fk text;
  change_fk text;
begin
  select lower(pg_get_constraintdef(oid)) into reservation_fk
  from pg_constraint
  where conrelid = 'public.reservation_audit_events'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike '%reservation_id%business_id%reservations%';

  select lower(pg_get_constraintdef(oid)) into change_fk
  from pg_constraint
  where conrelid = 'public.reservation_audit_events'::regclass
    and contype = 'f'
    and pg_get_constraintdef(oid) ilike '%change_request_id%business_id%reservation_change_requests%';

  if reservation_fk not like '%on delete cascade%'
     or change_fk not like '%on delete cascade%' then
    raise exception 'FAIL: B42 regresses safe tenant delete lifecycle';
  end if;
end $$;

rollback;
\echo 'PASS platform_reservation_audit.sql · append-only tenant-scoped reservation audit B42'

