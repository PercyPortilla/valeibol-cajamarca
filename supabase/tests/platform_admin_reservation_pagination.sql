-- Plataforma global · Bloque 51
\set ON_ERROR_STOP on
begin;

do $$
declare
  page_fn text;
  pos_filter integer;
  pos_cursor integer;
  pos_order integer;
  pos_limit integer;
begin
  select lower(pg_get_functiondef(
    'public.get_admin_reservations_page(text,integer,timestamptz,timestamptz,uuid)'::regprocedure
  )) into page_fn;

  pos_filter := strpos(page_fn, 'v_view = ''active''');
  pos_cursor := strpos(page_fn, '(r.start_at, r.created_at, r.id) < (p_cursor_start_at, p_cursor_created_at, p_cursor_id)');
  pos_order := strpos(page_fn, 'order by r.start_at desc, r.created_at desc, r.id desc');
  pos_limit := strpos(page_fn, 'limit v_limit');

  if page_fn not like '%phase6_admin_actor()%'
     or page_fn not like '%r.business_id = v_actor.business_id%'
     or page_fn not like '%invalid_reservation_view%'
     or page_fn not like '%invalid_reservation_cursor%'
     or page_fn not like '%num_nonnulls(p_cursor_start_at, p_cursor_created_at, p_cursor_id)%'
     or page_fn not like '%v_view = ''completed''%status = ''completed''%'
     or page_fn not like '%v_view = ''cancelled''%status = ''cancelled''%'
     or page_fn not like '%v_view = ''archived''%archived_at is not null%'
     or page_fn like '%p_business_id%'
     or pos_filter = 0
     or pos_cursor <= pos_filter
     or pos_order <= pos_cursor
     or pos_limit <= pos_order
  then
    raise exception 'FAIL: B51 server-side pagination contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.get_admin_reservations_page(text,integer,timestamptz,timestamptz,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute get_admin_reservations_page';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_admin_reservations_page(text,integer,timestamptz,timestamptz,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated admin path cannot execute get_admin_reservations_page';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin_reservation_pagination.sql · historial admin paginado B51'
