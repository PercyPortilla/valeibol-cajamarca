-- Plataforma global · Bloque 5
-- Verifica contrato autoritativo multi-deporte sin mutar datos permanentes.
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  select pg_get_functiondef(
    'public.create_public_reservation_request(text,uuid,date,time without time zone,time without time zone,smallint,text,text,boolean,uuid)'::regprocedure
  ) into definition;

  if definition not like '%from public.sports s%' then
    raise exception 'FAIL: reserva pública no resuelve el deporte de la cancha';
  end if;
  if definition not like '%v_sport_slug = ''voley''%' then
    raise exception 'FAIL: falta regla específica de altura para vóley';
  end if;
  if definition not like '%net_height_not_applicable%' then
    raise exception 'FAIL: deportes sin red no rechazan altura de red inesperada';
  end if;
  if definition not like '%p_net_height_cm is null%' then
    raise exception 'FAIL: no se contempla altura nullable';
  end if;
end $$;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.create_public_reservation_request(text,uuid,date,time without time zone,time without time zone,smallint,text,text,boolean,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.create_public_reservation_request(text,uuid,date,time without time zone,time without time zone,smallint,text,text,boolean,uuid)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: navegador recuperó acceso directo a la RPC autoritativa';
  end if;
end $$;

rollback;
\echo 'PASS multi_sport_booking.sql · reglas por deporte y privilegios'
