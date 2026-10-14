-- Valeibol · Fase 8 WhatsApp outbox
\set ON_ERROR_STOP on
begin;

-- El outbox contiene PII operativa y nunca debe ser visible para navegador.
do $$
begin
  if has_table_privilege('anon', 'public.whatsapp_outbox', 'SELECT')
     or has_table_privilege('authenticated', 'public.whatsapp_outbox', 'SELECT')
     or has_table_privilege('anon', 'public.whatsapp_outbox', 'INSERT')
     or has_table_privilege('authenticated', 'public.whatsapp_outbox', 'UPDATE') then
    raise exception 'FAIL: whatsapp_outbox expuesto a cliente';
  end if;

  if has_function_privilege('anon', 'public.phase8_claim_whatsapp_messages(integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.phase8_claim_whatsapp_messages(integer)', 'EXECUTE') then
    raise exception 'FAIL: navegador puede reclamar mensajes WhatsApp';
  end if;

  if not has_function_privilege('service_role', 'public.phase8_claim_whatsapp_messages(integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.phase8_complete_whatsapp_message(uuid,boolean,text,text)', 'EXECUTE') then
    raise exception 'FAIL: worker server-side no puede procesar outbox';
  end if;
end $$;

insert into public.customers (
  id, business_id, full_name, phone_e164, marketing_opt_in
) values (
  '30000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000001',
  'Cliente de prueba Fase 8',
  '+51911111118',
  false
);

insert into public.reservations (
  id, business_id, court_id, customer_id,
  start_at, end_at, status, lighting, hourly_rate, total_amount, source
) values (
  '40000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000008',
  ((current_date + 10) + time '18:00') at time zone 'America/Lima',
  ((current_date + 10) + time '19:00') at time zone 'America/Lima',
  'pending',
  'without_lights',
  35,
  35,
  'public_web'
);

do $$
declare
  n integer;
begin
  select count(*) into n
  from public.whatsapp_outbox
  where reservation_id = '40000000-0000-4000-8000-000000000008'
    and kind = 'owner_new_request'
    and recipient_e164 = '+51935059868';

  if n <> 1 then
    raise exception 'FAIL: solicitud pending debe encolar exactamente 1 aviso al propietario, obtuvo %', n;
  end if;
end $$;

update public.reservations
set status = 'confirmed'
where id = '40000000-0000-4000-8000-000000000008';

update public.reservations
set status = 'confirmed'
where id = '40000000-0000-4000-8000-000000000008';

update public.reservations
set status = 'cancelled'
where id = '40000000-0000-4000-8000-000000000008';

do $$
declare
  confirmed_count integer;
  cancelled_count integer;
begin
  select count(*) into confirmed_count
  from public.whatsapp_outbox
  where reservation_id = '40000000-0000-4000-8000-000000000008'
    and kind = 'customer_confirmed'
    and recipient_e164 = '+51911111118';

  select count(*) into cancelled_count
  from public.whatsapp_outbox
  where reservation_id = '40000000-0000-4000-8000-000000000008'
    and kind = 'customer_cancelled'
    and recipient_e164 = '+51911111118';

  if confirmed_count <> 1 then
    raise exception 'FAIL: confirmación no es idempotente (% mensajes)', confirmed_count;
  end if;
  if cancelled_count <> 1 then
    raise exception 'FAIL: cancelación debe encolar exactamente 1 mensaje (%)', cancelled_count;
  end if;
end $$;

rollback;
\echo 'PASS phase8.sql · privacidad/outbox/idempotencia/transiciones'
