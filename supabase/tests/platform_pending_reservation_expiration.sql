-- Plataforma global · Bloque 49
\set ON_ERROR_STOP on
begin;

do $$
declare
  expire_fn text;
  reject_fn text;
  edit_fn text;
  notify_fn text;
  audit_fn text;
begin
  select lower(pg_get_functiondef('public.admin_expire_pending_reservation(uuid)'::regprocedure)) into expire_fn;
  select lower(pg_get_functiondef('public.admin_reject_pending_reservation(uuid)'::regprocedure)) into reject_fn;
  select lower(pg_get_functiondef('public.admin_edit_reservation(uuid,uuid,date,time,time,smallint,text,text)'::regprocedure)) into edit_fn;
  select lower(pg_get_functiondef('public.block49_queue_pending_expiration_notification()'::regprocedure)) into notify_fn;
  select lower(pg_get_functiondef('public.block42_audit_reservation()'::regprocedure)) into audit_fn;

  if expire_fn not like '%phase6_admin_actor()%'
     or expire_fn not like '%business_id = v_actor.business_id%for update%'
     or expire_fn not like '%status <> ''pending''%'
     or expire_fn not like '%source <> ''public_web''%'
     or expire_fn not like '%start_at > now()%pending_reservation_not_expired%'
     or expire_fn not like '%closure_kind = ''request_expiration''%'
     or reject_fn not like '%start_at <= now()%pending_reservation_expired_requires_expiration%'
     or edit_fn not like '%status = ''confirmed''%confirmed_reschedule_requires_request%'
     or edit_fn not like '%start_at <= now()%pending_reservation_expired_requires_expiration%'
     or notify_fn not like '%reservation_expired%'
     or audit_fn not like '%request_expiration%reservation_expired%'
  then
    raise exception 'FAIL: B49 pending expiration contract incomplete';
  end if;
end $$;

do $$
begin
  if to_regprocedure('public.admin_edit_reservation(uuid,uuid,date,time,time,public.lighting_mode,text,text)') is not null then
    raise exception 'FAIL: legacy lighting overload of admin_edit_reservation still exists';
  end if;
  if has_function_privilege('anon', 'public.admin_expire_pending_reservation(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can expire pending reservation';
  end if;
  if has_function_privilege('anon', 'public.block49_queue_pending_expiration_notification()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.block49_queue_pending_expiration_notification()', 'EXECUTE') then
    raise exception 'FAIL: B49 internal notification trigger is directly executable';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.reservations'::regclass
      and c.conname = 'reservations_closure_kind_check'
      and lower(pg_get_constraintdef(c.oid)) like '%request_expiration%'
  ) then
    raise exception 'FAIL: B49 request_expiration missing from closure constraint';
  end if;
end $$;

rollback;
\echo 'PASS platform_pending_reservation_expiration.sql · pending reservation expiry B49'
