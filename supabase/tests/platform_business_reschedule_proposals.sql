-- Plataforma global · Bloque 44
\set ON_ERROR_STOP on
begin;

do $$
declare
  propose_fn text;
  respond_fn text;
  guard_fn text;
  admin_resolve_fn text;
begin
  select lower(pg_get_functiondef('public.admin_propose_reservation_reschedule(uuid,uuid,date,time,time,text)'::regprocedure)) into propose_fn;
  select lower(pg_get_functiondef('public.respond_to_business_reschedule_proposal(uuid,boolean)'::regprocedure)) into respond_fn;
  select lower(pg_get_functiondef('public.block44_guard_business_proposal_resolution()'::regprocedure)) into guard_fn;
  select lower(pg_get_functiondef('public.admin_resolve_reservation_change_request(uuid,boolean,text)'::regprocedure)) into admin_resolve_fn;

  if propose_fn not like '%phase6_admin_actor()%'
     or propose_fn not like '%role not in (''owner'',''admin'')%'
     or propose_fn not like '%from public.reservations r%for update%from public.reservation_change_requests q%for update%'
     or propose_fn not like '%court_schedule_entries%'
     or propose_fn not like '%pg_advisory_xact_lock%'
     or propose_fn not like '%v_request.initiator_kind = ''business''%'
     or propose_fn not like '%v_request.requested_court_id = p_court_id%'
     or propose_fn like '%update public.reservations%'
     or respond_fn not like '%auth.uid()%'
     or respond_fn not like '%q.user_id = v_uid%'
     or respond_fn not like '%q.initiator_kind = ''business''%'
     or position('if not p_accept then' in respond_fn) = 0
     or position('v_reservation.status <> ''confirmed''' in respond_fn) <= position('if not p_accept then' in respond_fn)
     or respond_fn not like '%reschedule_quote_changed%'
     or respond_fn not like '%update public.reservations%'
     or guard_fn not like '%business_reschedule_requires_customer_response%'
     or admin_resolve_fn not like '%v_request.initiator_kind = ''business''%business_reschedule_requires_customer_response%'
  then
    raise exception 'FAIL: B44 proposal/response contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.admin_propose_reservation_reschedule(uuid,uuid,date,time,time,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_admin_reschedule_courts(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.respond_to_business_reschedule_proposal(uuid,boolean)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute B44 authenticated workflows';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.reservation_change_requests'::regclass
      and c.conname = 'reservation_change_requests_initiator_kind_check'
  ) then
    raise exception 'FAIL: B44 initiator constraint missing';
  end if;
end $$;

rollback;
\echo 'PASS platform_business_reschedule_proposals.sql · business initiated reschedule workflow B44'
