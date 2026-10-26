-- Plataforma global · Bloque 37
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select lower(pg_get_functiondef('public.claim_public_reservation(uuid)'::regprocedure)) into definition;
  if definition not like '%auth.uid()%'
     or definition not like '%r.request_token = p_request_token%'
     or definition not like '%r.source = ''public_web''%'
     or definition not like '%for update%'
     or definition not like '%v_reservation.user_id is not null and v_reservation.user_id <> v_user_id%'
     or definition not like '%set user_id = v_user_id%'
  then
    raise exception 'FAIL: B37 no deriva identidad/posesión o no protege concurrencia';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.claim_public_reservation(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon puede reclamar reservas B37';
  end if;
  if not has_function_privilege('authenticated', 'public.claim_public_reservation(uuid)', 'EXECUTE') then
    raise exception 'FAIL: authenticated no puede reclamar reservas B37';
  end if;
end $$;

rollback;
\echo 'PASS platform_customer_reservation_claim.sql · secure reservation claim B37'

