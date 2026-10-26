-- Plataforma global · Bloque 56
\set ON_ERROR_STOP on
begin;

do $$
declare
  audit_fn text;
begin
  select lower(pg_get_functiondef(
    'public.get_admin_reservation_audit_page(uuid,integer,timestamptz,bigint)'::regprocedure
  )) into audit_fn;

  if audit_fn not like '%phase6_admin_actor()%'
     or audit_fn not like '%r.id = p_reservation_id%'
     or audit_fn not like '%r.business_id = v_actor.business_id%'
     or audit_fn not like '%e.business_id = v_actor.business_id%'
     or audit_fn not like '%num_nonnulls(p_cursor_created_at, p_cursor_event_sequence)%'
     or audit_fn not like '%(e.created_at, e.event_sequence) < (p_cursor_created_at, p_cursor_event_sequence)%'
     or audit_fn not like '%order by e.created_at desc, e.event_sequence desc%'
     or audit_fn not like '%q.business_id = e.business_id%'
     or audit_fn not like '%q.reservation_id = e.reservation_id%'
     or audit_fn like '%p_business_id%'
  then
    raise exception 'FAIL: B56 reservation audit pagination contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.get_admin_reservation_audit_page(uuid,integer,timestamptz,bigint)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon can execute get_admin_reservation_audit_page';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_admin_reservation_audit_page(uuid,integer,timestamptz,bigint)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated cannot execute get_admin_reservation_audit_page';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin_reservation_audit_pagination.sql · historial de auditoría paginado B56'
