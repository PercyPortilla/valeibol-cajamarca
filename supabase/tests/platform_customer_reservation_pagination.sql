-- Plataforma global · Bloque 60
\set ON_ERROR_STOP on
begin;

do $$
declare
  reservations_fn text;
  changes_fn text;
begin
  select lower(pg_get_functiondef(
    'public.get_my_reservations_page(integer,timestamptz,uuid)'::regprocedure
  )) into reservations_fn;
  select lower(pg_get_functiondef(
    'public.get_my_latest_reservation_change_requests(uuid[])'::regprocedure
  )) into changes_fn;

  if reservations_fn not like '%v_uid uuid := auth.uid()%'
     or reservations_fn not like '%r.user_id = v_uid%'
     or reservations_fn not like '%num_nonnulls(p_cursor_created_at, p_cursor_id)%'
     or reservations_fn not like '%(r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)%'
     or reservations_fn not like '%order by r.created_at desc, r.id desc%'
     or reservations_fn like '%p_user_id%'
     or reservations_fn like '%p_business_id%'
  then
    raise exception 'FAIL: B60 customer reservation page contract incomplete';
  end if;

  if changes_fn not like '%v_uid uuid := auth.uid()%'
     or changes_fn not like '%owned.user_id = v_uid%'
     or changes_fn not like '%q.user_id = v_uid%'
     or changes_fn not like '%q.reservation_id = any(p_reservation_ids)%'
     or changes_fn not like '%cardinality(p_reservation_ids) > 100%'
     or changes_fn not like '%partition by q.reservation_id, q.request_type, q.initiator_kind%'
     or changes_fn not like '%where q.rn = 1%'
     or changes_fn like '%p_user_id%'
  then
    raise exception 'FAIL: B60 visible reservation change-request contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.get_my_reservations_page(integer,timestamptz,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_my_latest_reservation_change_requests(uuid[])', 'EXECUTE') then
    raise exception 'FAIL: anon can execute B60 customer functions';
  end if;

  if not has_function_privilege('authenticated', 'public.get_my_reservations_page(integer,timestamptz,uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_my_latest_reservation_change_requests(uuid[])', 'EXECUTE') then
    raise exception 'FAIL: authenticated lacks B60 customer functions';
  end if;
end $$;

rollback;
\echo 'PASS platform_customer_reservation_pagination.sql · historial cliente paginado B60'
