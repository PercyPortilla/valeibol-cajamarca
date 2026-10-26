-- Plataforma global · Bloque 52
\set ON_ERROR_STOP on
begin;

do $$
declare
  resolve_fn text;
  my_requests_fn text;
  audit_fn text;
begin
  select lower(pg_get_functiondef(
    'public.admin_resolve_reservation_change_request(uuid,boolean,text)'::regprocedure
  )) into resolve_fn;

  select lower(pg_get_functiondef(
    'public.get_my_reservation_change_requests()'::regprocedure
  )) into my_requests_fn;

  select lower(pg_get_functiondef(
    'public.get_admin_reservation_audit(uuid,integer)'::regprocedure
  )) into audit_fn;

  if resolve_fn not like '%p_resolution_note text%'
     or resolve_fn not like '%regexp_replace%p_resolution_note%'
     or resolve_fn not like '%resolution_note_too_long%'
     or resolve_fn not like '%resolution_note = v_note%'
     or resolve_fn not like '%resolution_kind = ''admin_resolution''%'
     or resolve_fn not like '%resolution_note is not distinct from v_note%'
  then
    raise exception 'FAIL: B52 admin resolution note contract incomplete';
  end if;

  if my_requests_fn not like '%auth.uid()%'
     or my_requests_fn not like '%q.resolution_note%'
  then
    raise exception 'FAIL: B52 customer read contract does not expose own resolution note';
  end if;

  if audit_fn not like '%left join public.reservation_change_requests q%'
     or audit_fn not like '%q.business_id = e.business_id%'
     or audit_fn not like '%q.reservation_id = e.reservation_id%'
     or audit_fn not like '%new_request_status%approved%rejected%q.resolution_note%'
  then
    raise exception 'FAIL: B52 audit resolution note contract incomplete';
  end if;
end $$;

rollback;
\echo 'PASS platform_change_request_resolution_note.sql · respuesta de resolución visible B52'
