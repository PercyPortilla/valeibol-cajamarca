-- Plataforma global · Bloque 48
\set ON_ERROR_STOP on
begin;

do $$
declare
  reject_fn text;
  confirm_fn text;
  cancel_fn text;
  withdraw_fn text;
  notify_fn text;
  audit_fn text;
begin
  select lower(pg_get_functiondef('public.admin_reject_pending_reservation(uuid)'::regprocedure)) into reject_fn;
  select lower(pg_get_functiondef('public.admin_confirm_reservation(uuid)'::regprocedure)) into confirm_fn;
  select lower(pg_get_functiondef('public.admin_cancel_reservation(uuid)'::regprocedure)) into cancel_fn;
  select lower(pg_get_functiondef('public.withdraw_my_pending_reservation(uuid)'::regprocedure)) into withdraw_fn;
  select lower(pg_get_functiondef('public.block41_queue_reservation_notification()'::regprocedure)) into notify_fn;
  select lower(pg_get_functiondef('public.block42_audit_reservation()'::regprocedure)) into audit_fn;

  if reject_fn not like '%phase6_admin_actor()%'
     or reject_fn not like '%business_id = v_actor.business_id%for update%'
     or reject_fn not like '%status <> ''pending''%'
     or reject_fn not like '%source <> ''public_web''%'
     or reject_fn not like '%closure_kind = ''business_rejection''%'
     or confirm_fn not like '%start_at <= now()%reservation_confirmation_window_closed%'
     or cancel_fn not like '%status = ''pending''%pending_reservation_requires_rejection%'
     or cancel_fn not like '%from public.reservation_change_requests q%status = ''pending''%for update%'
     or cancel_fn not like '%closure_kind = ''confirmed_cancellation''%'
     or withdraw_fn not like '%closure_kind = ''customer_withdrawal''%'
     or withdraw_fn not like '%last_modified_by = v_uid%'
     or notify_fn not like '%reservation_rejected%'
     or notify_fn not like '%reservation_cancelled%'
     or notify_fn not like '%reservation_withdrawn%'
     or audit_fn not like '%reservation_rejected%'
     or audit_fn not like '%reservation_withdrawn%'
  then
    raise exception 'FAIL: B48 decision lifecycle contract incomplete';
  end if;
end $$;

do $$
declare
  migration_text text;
begin
  migration_text := lower(pg_get_functiondef('public.withdraw_my_pending_reservation(uuid)'::regprocedure));
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservations'
      and column_name = 'closure_kind'
  ) then
    raise exception 'FAIL: B48 closure_kind column missing';
  end if;
  if migration_text not like '%closure_kind = ''customer_withdrawal''%' then
    raise exception 'FAIL: B48 B30 withdrawal does not persist closure_kind';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.admin_reject_pending_reservation(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can reject pending reservation';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.reservations'::regclass
      and c.conname = 'reservations_closure_kind_check'
      and lower(pg_get_constraintdef(c.oid)) like '%business_rejection%'
      and lower(pg_get_constraintdef(c.oid)) like '%customer_withdrawal%'
      and lower(pg_get_constraintdef(c.oid)) like '%confirmed_cancellation%'
  ) then
    raise exception 'FAIL: B48 reservations closure_kind constraint incomplete';
  end if;
end $$;

rollback;
\echo 'PASS platform_pending_reservation_rejection.sql · explicit pending decision lifecycle B48'
