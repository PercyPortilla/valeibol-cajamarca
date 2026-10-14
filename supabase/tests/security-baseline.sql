-- Valeibol · baseline transversal de seguridad Supabase
-- Requiere migraciones 001..006 aplicadas.
\set ON_ERROR_STOP on
begin;

-- 1) Toda función SECURITY DEFINER del esquema público debe fijar search_path.
do $$
declare
  unsafe_functions text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
  into unsafe_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=public, pg_temp%';

  if unsafe_functions is not null then
    raise exception 'FAIL: SECURITY DEFINER sin search_path seguro: %', unsafe_functions;
  end if;
end $$;

-- 2) Anon nunca puede ejecutar superficie administrativa.
do $$
declare
  exposed_functions text;
begin
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
  into exposed_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname like 'admin\_%' escape '\\' or p.proname like 'get\_admin\_%' escape '\\')
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if exposed_functions is not null then
    raise exception 'FAIL: anon puede ejecutar RPC administrativa: %', exposed_functions;
  end if;
end $$;

-- 3) PII y perfiles no son legibles directamente por anon.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['customers','reservations','profiles','schedule_blocks']
  loop
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT') then
      raise exception 'FAIL: anon puede leer directamente %', table_name;
    end if;
  end loop;
end $$;

-- 4) authenticated no recupera DML directo sobre tablas operativas sensibles.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','pricing_rules','customers','reservations','schedule_blocks'
  ]
  loop
    if has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') then
      raise exception 'FAIL: authenticated conserva DML directo sobre %', table_name;
    end if;
  end loop;
end $$;

-- 5) El enum de roles administrativos contiene únicamente los roles soportados.
do $$
declare
  labels text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder)
  into labels
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'app_role';

  if labels is distinct from array['owner','admin','staff']::text[] then
    raise exception 'FAIL: roles inesperados en app_role: %', labels;
  end if;
end $$;

-- 6) La escritura pública autoritativa solo es ejecutable por service_role tras hardening.
do $$
begin
  if has_function_privilege(
    'anon',
    'public.create_public_reservation_request(text,uuid,date,time,time,public.lighting_mode,text,text,boolean,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.create_public_reservation_request(text,uuid,date,time,time,public.lighting_mode,text,text,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: navegador puede ejecutar la RPC autoritativa de reserva';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.create_public_reservation_request(text,uuid,date,time,time,public.lighting_mode,text,text,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: service_role no puede ejecutar la RPC autoritativa';
  end if;
end $$;

rollback;
\echo 'PASS security-baseline.sql · SECURITY DEFINER/RPC/PII/DML/roles'
