-- Plataforma global · Bloque 41
\set ON_ERROR_STOP on
begin;

do $$
declare
  customer_list text;
  admin_list text;
  customer_mark text;
  admin_mark text;
  reservation_trigger text;
  change_trigger text;
begin
  select lower(pg_get_functiondef('public.get_my_notifications(integer)'::regprocedure)) into customer_list;
  select lower(pg_get_functiondef('public.get_admin_notifications(integer)'::regprocedure)) into admin_list;
  select lower(pg_get_functiondef('public.mark_my_notification_read(uuid)'::regprocedure)) into customer_mark;
  select lower(pg_get_functiondef('public.mark_admin_notification_read(uuid)'::regprocedure)) into admin_mark;
  select lower(pg_get_functiondef('public.block41_queue_reservation_notification()'::regprocedure)) into reservation_trigger;
  select lower(pg_get_functiondef('public.block41_queue_change_request_notification()'::regprocedure)) into change_trigger;

  if customer_list not like '%n.recipient_user_id = (select auth.uid())%'
     or customer_list not like '%n.audience = ''customer''%'
     or admin_list not like '%phase6_admin_actor()%'
     or admin_list not like '%n.business_id = v_actor.business_id%'
     or customer_mark not like '%n.recipient_user_id = v_uid%'
     or admin_mark not like '%n.business_id = v_actor.business_id%'
     or reservation_trigger not like '%reservation_requested%'
     or reservation_trigger not like '%reservation_confirmed%'
     or reservation_trigger not like '%old.status = new.status%'
     or reservation_trigger not like '%old.user_id is distinct from new.user_id%'
     or reservation_trigger not like '%then now()%'
     or change_trigger not like '%cancellation_requested%'
     or change_trigger not like '%reschedule_requested%'
     or change_trigger not like '%reschedule_approved%'
  then
    raise exception 'FAIL: B41 notification isolation/event contract incomplete';
  end if;
end $$;

do $$
begin
  if has_table_privilege('anon', 'public.app_notifications', 'SELECT')
     or has_table_privilege('authenticated', 'public.app_notifications', 'SELECT')
     or has_table_privilege('authenticated', 'public.app_notifications', 'INSERT')
     or has_table_privilege('authenticated', 'public.app_notification_reads', 'UPDATE') then
    raise exception 'FAIL: B41 notification tables exposed directly';
  end if;
  if has_function_privilege('anon', 'public.get_my_notifications(integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_admin_notifications(integer)', 'EXECUTE') then
    raise exception 'FAIL: anon can read B41 notifications';
  end if;
  if has_function_privilege('authenticated', 'public.block41_queue_reservation_notification()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.block41_queue_change_request_notification()', 'EXECUTE') then
    raise exception 'FAIL: authenticated can execute internal B41 trigger functions';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_notifications_reservation_business_fk'
      and contype = 'f'
  ) or not exists (
    select 1
    from pg_constraint
    where conname = 'app_notifications_change_business_fk'
      and contype = 'f'
  ) then
    raise exception 'FAIL: B41 lacks composite tenant/source foreign keys';
  end if;
end $$;

rollback;
\echo 'PASS platform_notification_center.sql · notification isolation/events/read-state B41'

