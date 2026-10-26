-- Plataforma global · Bloque 57
\set ON_ERROR_STOP on
begin;

do $$
declare
  notifications_fn text;
begin
  select lower(pg_get_functiondef(
    'public.get_admin_notifications_page(integer,timestamptz,uuid)'::regprocedure
  )) into notifications_fn;

  if notifications_fn not like '%phase6_admin_actor()%'
     or notifications_fn not like '%n.audience = ''admin''%'
     or notifications_fn not like '%n.business_id = v_actor.business_id%'
     or notifications_fn not like '%reads.user_id = v_actor.user_id%'
     or notifications_fn not like '%num_nonnulls(p_cursor_created_at, p_cursor_id)%'
     or notifications_fn not like '%(n.created_at, n.id) < (p_cursor_created_at, p_cursor_id)%'
     or notifications_fn not like '%order by n.created_at desc, n.id desc%'
     or notifications_fn like '%p_business_id%'
     or notifications_fn like '%p_user_id%'
  then
    raise exception 'FAIL: B57 admin notification pagination contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.get_admin_notifications_page(integer,timestamptz,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute get_admin_notifications_page';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_admin_notifications_page(integer,timestamptz,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated cannot execute get_admin_notifications_page';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin_notification_pagination.sql · notificaciones admin paginadas B57'
