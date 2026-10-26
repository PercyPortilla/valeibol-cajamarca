-- Plataforma global · Bloque 59
\set ON_ERROR_STOP on
begin;

do $$
declare
  page_fn text;
  flags_fn text;
begin
  select lower(pg_get_functiondef(
    'public.get_admin_pending_reservation_change_requests_page(integer,timestamptz,uuid)'::regprocedure
  )) into page_fn;
  select lower(pg_get_functiondef(
    'public.get_admin_pending_change_reservation_ids(uuid[])'::regprocedure
  )) into flags_fn;

  if page_fn not like '%phase6_admin_actor()%'
     or page_fn not like '%q.business_id = v_actor.business_id%'
     or page_fn not like '%q.status = ''pending''%'
     or page_fn not like '%num_nonnulls(p_cursor_created_at, p_cursor_id)%'
     or page_fn not like '%(q.created_at, q.id) < (p_cursor_created_at, p_cursor_id)%'
     or page_fn not like '%order by q.created_at desc, q.id desc%'
     or position('q.status = ''pending''' in page_fn) > position('limit v_limit' in page_fn)
     or page_fn like '%p_business_id%'
  then
    raise exception 'FAIL: B59 pending change-request page contract incomplete';
  end if;

  if flags_fn not like '%phase6_admin_actor()%'
     or flags_fn not like '%q.business_id = v_actor.business_id%'
     or flags_fn not like '%q.status = ''pending''%'
     or flags_fn not like '%q.reservation_id = any(p_reservation_ids)%'
     or flags_fn not like '%cardinality(p_reservation_ids) > 100%'
     or flags_fn like '%p_business_id%'
  then
    raise exception 'FAIL: B59 visible reservation pending flags contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.get_admin_pending_reservation_change_requests_page(integer,timestamptz,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.get_admin_pending_change_reservation_ids(uuid[])',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute B59 admin functions';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_admin_pending_reservation_change_requests_page(integer,timestamptz,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_admin_pending_change_reservation_ids(uuid[])',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated lacks B59 admin functions';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin_pending_change_request_pagination.sql · pendientes admin paginados B59'
