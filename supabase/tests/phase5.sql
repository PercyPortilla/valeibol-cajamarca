\set ON_ERROR_STOP on

begin;

do $$
begin
  if has_table_privilege('anon', 'public.customers', 'SELECT') then
    raise exception 'FAIL: anon no debe poder leer customers';
  end if;
  if has_table_privilege('anon', 'public.reservations', 'SELECT') then
    raise exception 'FAIL: anon no debe poder leer reservations';
  end if;
  if has_table_privilege('anon', 'public.profiles', 'SELECT') then
    raise exception 'FAIL: anon no debe poder leer profiles';
  end if;

  if not has_table_privilege('authenticated', 'public.reservations', 'SELECT') then
    raise exception 'FAIL: authenticated requiere SELECT; RLS limita filas por negocio';
  end if;
  if has_table_privilege('authenticated', 'public.reservations', 'INSERT')
     or has_table_privilege('authenticated', 'public.reservations', 'UPDATE')
     or has_table_privilege('authenticated', 'public.reservations', 'DELETE') then
    raise exception 'FAIL: Fase 5 debe ser solo lectura administrativa directa';
  end if;
  if has_table_privilege('authenticated', 'public.customers', 'UPDATE') then
    raise exception 'FAIL: authenticated no debe editar customers en Fase 5';
  end if;

  if has_function_privilege('anon', 'public.get_current_admin_context()', 'EXECUTE') then
    raise exception 'FAIL: anon no debe ejecutar get_current_admin_context';
  end if;
  if has_function_privilege('anon', 'public.get_admin_reservation_requests(integer)', 'EXECUTE') then
    raise exception 'FAIL: anon no debe ejecutar get_admin_reservation_requests';
  end if;
  if not has_function_privilege('authenticated', 'public.get_current_admin_context()', 'EXECUTE') then
    raise exception 'FAIL: authenticated autorizado necesita el RPC de contexto';
  end if;
  if not has_function_privilege('authenticated', 'public.get_admin_reservation_requests(integer)', 'EXECUTE') then
    raise exception 'FAIL: authenticated necesita el RPC de lectura de solicitudes';
  end if;

  if pg_get_function_result('public.get_public_availability(text,date,date)'::regprocedure) ~* 'customer_id|full_name|phone_e164|internal_notes' then
    raise exception 'FAIL: la disponibilidad pública no debe declarar PII';
  end if;
end $$;

rollback;
\echo 'PASS phase5.sql · privilegios/RLS/superficie pública'
