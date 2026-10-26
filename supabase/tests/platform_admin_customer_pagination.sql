-- Plataforma global · Bloque 55
\set ON_ERROR_STOP on
begin;

do $$
declare
  customers_fn text;
  summary_fn text;
  history_fn text;
begin
  select lower(pg_get_functiondef(
    'public.get_admin_customers_page(integer,timestamptz,uuid)'::regprocedure
  )) into customers_fn;

  select lower(pg_get_functiondef(
    'public.get_admin_customer_summary(uuid)'::regprocedure
  )) into summary_fn;

  select lower(pg_get_functiondef(
    'public.get_admin_customer_history_page(uuid,integer,timestamptz,uuid)'::regprocedure
  )) into history_fn;

  if customers_fn not like '%phase6_admin_actor()%'
     or customers_fn not like '%c.business_id = v_actor.business_id%'
     or customers_fn not like '%num_nonnulls(p_cursor_created_at, p_cursor_id)%'
     or customers_fn not like '%(s.customer_created_at, s.customer_id) < (p_cursor_created_at, p_cursor_id)%'
     or customers_fn not like '%order by s.customer_created_at desc, s.customer_id desc%'
     or customers_fn like '%p_business_id%'
  then
    raise exception 'FAIL: B55 customer directory pagination contract incomplete';
  end if;

  if summary_fn not like '%phase6_admin_actor()%'
     or summary_fn not like '%c.id = p_customer_id%'
     or summary_fn not like '%c.business_id = v_actor.business_id%'
     or summary_fn like '%p_business_id%'
  then
    raise exception 'FAIL: B55 selected customer tenant contract incomplete';
  end if;

  if history_fn not like '%phase6_admin_actor()%'
     or history_fn not like '%c.id = p_customer_id%'
     or history_fn not like '%c.business_id = v_actor.business_id%'
     or history_fn not like '%num_nonnulls(p_cursor_created_at, p_cursor_id)%'
     or history_fn not like '%(r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)%'
     or history_fn not like '%order by r.created_at desc, r.id desc%'
     or history_fn like '%p_cursor_start_at%'
     or history_fn like '%p_business_id%'
  then
    raise exception 'FAIL: B55 customer history pagination contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.get_admin_customers_page(integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute get_admin_customers_page';
  end if;
  if has_function_privilege('anon', 'public.get_admin_customer_summary(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute get_admin_customer_summary';
  end if;
  if has_function_privilege('anon', 'public.get_admin_customer_history_page(uuid,integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute get_admin_customer_history_page';
  end if;
  if not has_function_privilege('authenticated', 'public.get_admin_customers_page(integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'FAIL: authenticated cannot execute get_admin_customers_page';
  end if;
  if not has_function_privilege('authenticated', 'public.get_admin_customer_summary(uuid)', 'EXECUTE') then
    raise exception 'FAIL: authenticated cannot execute get_admin_customer_summary';
  end if;
  if not has_function_privilege('authenticated', 'public.get_admin_customer_history_page(uuid,integer,timestamptz,uuid)', 'EXECUTE') then
    raise exception 'FAIL: authenticated cannot execute get_admin_customer_history_page';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin_customer_pagination.sql · clientes e historial paginados B55'
