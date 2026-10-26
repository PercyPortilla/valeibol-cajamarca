-- Plataforma global · Bloque 53
\set ON_ERROR_STOP on
begin;

do $$
declare
  export_fn text;
  anon_exec boolean;
  authenticated_exec boolean;
begin
  select lower(pg_get_functiondef(
    'public.get_admin_export_reservations_page(date,date,integer,timestamptz,uuid,timestamptz,uuid)'::regprocedure
  )) into export_fn;

  if export_fn not like '%phase6_admin_actor()%'
     or export_fn not like '%r.business_id = v_actor.business_id%'
     or export_fn not like '%at time zone v_actor.timezone%'
     or export_fn not like '%num_nonnulls(p_cursor_created_at, p_cursor_id)%'
     or export_fn not like '%num_nonnulls(p_snapshot_created_at, p_snapshot_id)%'
     or export_fn not like '%(r.created_at, r.id) > (p_cursor_created_at, p_cursor_id)%'
     or export_fn not like '%(r.created_at, r.id) <= (v_snapshot_created_at, v_snapshot_id)%'
     or export_fn not like '%order by r.created_at asc, r.id asc%'
     or export_fn not like '%least(coalesce(p_limit, 500), 500)%'
  then
    raise exception 'FAIL: B53 export pagination contract incomplete';
  end if;

  select has_function_privilege(
    'anon',
    'public.get_admin_export_reservations_page(date,date,integer,timestamptz,uuid,timestamptz,uuid)',
    'EXECUTE'
  ) into anon_exec;
  select has_function_privilege(
    'authenticated',
    'public.get_admin_export_reservations_page(date,date,integer,timestamptz,uuid,timestamptz,uuid)',
    'EXECUTE'
  ) into authenticated_exec;

  if anon_exec then
    raise exception 'FAIL: anon must not execute B53 export RPC';
  end if;
  if not authenticated_exec then
    raise exception 'FAIL: authenticated must execute B53 export RPC through actor guard';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin_export_completeness.sql · export completo B53'
