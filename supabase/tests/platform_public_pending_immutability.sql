-- Plataforma global · Bloque 50
\set ON_ERROR_STOP on
begin;

do $$
declare
  edit_fn text;
  pos_confirmed integer;
  pos_stale integer;
  pos_public integer;
  pos_update integer;
begin
  select lower(pg_get_functiondef(
    'public.admin_edit_reservation(uuid,uuid,date,time,time,smallint,text,text)'::regprocedure
  )) into edit_fn;

  pos_confirmed := strpos(edit_fn, 'confirmed_reschedule_requires_request');
  pos_stale := strpos(edit_fn, 'pending_reservation_expired_requires_expiration');
  pos_public := strpos(edit_fn, 'public_pending_request_not_editable');
  pos_update := strpos(edit_fn, 'update public.reservations');

  if edit_fn not like '%phase6_admin_actor()%'
     or edit_fn not like '%business_id = v_actor.business_id%for update%'
     or edit_fn not like '%source = ''public_web''%public_pending_request_not_editable%'
     or pos_confirmed = 0
     or pos_stale <= pos_confirmed
     or pos_public <= pos_stale
     or pos_update <= pos_public
  then
    raise exception 'FAIL: B50 public_web pending immutability contract incomplete';
  end if;
end $$;

do $$
begin
  if to_regprocedure(
    'public.admin_edit_reservation(uuid,uuid,date,time,time,public.lighting_mode,text,text)'
  ) is not null then
    raise exception 'FAIL: legacy admin_edit_reservation overload still exists';
  end if;

  if has_function_privilege(
    'anon',
    'public.admin_edit_reservation(uuid,uuid,date,time,time,smallint,text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute admin_edit_reservation';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.admin_edit_reservation(uuid,uuid,date,time,time,smallint,text,text)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated admin path cannot execute admin_edit_reservation';
  end if;
end $$;

rollback;
\echo 'PASS platform_public_pending_immutability.sql · public_web PENDING immutable B50'
