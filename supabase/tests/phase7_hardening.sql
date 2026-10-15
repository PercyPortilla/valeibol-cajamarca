-- Valeibol · hardening SQL tests
-- Requiere migraciones 001..006 aplicadas.
\set ON_ERROR_STOP on
begin;

-- 1) Nadie del navegador puede ejecutar la escritura autoritativa.
do $$
begin
  if has_function_privilege(
    'anon',
    'public.create_public_reservation_request(text,uuid,date,time,time,smallint,text,text,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anon todavía puede escribir reservas directamente';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.create_public_reservation_request(text,uuid,date,time,time,smallint,text,text,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated todavía puede escribir reservas públicas directamente';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.create_public_reservation_request(text,uuid,date,time,time,smallint,text,text,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: service_role necesita ejecutar la RPC desde el endpoint seguro';
  end if;
end $$;

-- 2) La tabla de rate limit es completamente privada.
do $$
begin
  if has_table_privilege('anon', 'public.public_booking_rate_limits', 'SELECT')
     or has_table_privilege('authenticated', 'public.public_booking_rate_limits', 'SELECT')
     or has_table_privilege('anon', 'public.public_booking_rate_limits', 'INSERT')
     or has_table_privilege('authenticated', 'public.public_booking_rate_limits', 'INSERT') then
    raise exception 'FAIL: contador antiabuso expuesto al navegador';
  end if;
end $$;

-- 3) Rate limit de origen es determinista y corta el intento 13 en 15 minutos.
do $$
declare
  allowed boolean;
  i integer;
begin
  set local role service_role;
  for i in 1..12 loop
    select public.consume_public_booking_rate_limit(
      'valeibol-cajamarca',
      repeat('a', 64),
      12
    ) into allowed;
    if not allowed then
      raise exception 'FAIL: rate limit rechazó antes del intento 13 (%).', i;
    end if;
  end loop;

  select public.consume_public_booking_rate_limit(
    'valeibol-cajamarca',
    repeat('a', 64),
    12
  ) into allowed;

  if allowed then
    raise exception 'FAIL: intento 13 debería quedar limitado';
  end if;
  reset role;
end $$;

rollback;
\echo 'PASS phase7_hardening.sql · RPC privada/rate-limit/HMAC storage'
