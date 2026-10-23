-- Valeibol · Fase 8 WhatsApp outbox
\set ON_ERROR_STOP on
begin;

-- La normalización conserva E.164 válido y admite formato peruano local.
do $$
begin
  if public.phase8_normalize_peru_phone('+51911111118') <> '+51911111118' then
    raise exception 'FAIL: E.164 válido no se conserva';
  end if;
  if public.phase8_normalize_peru_phone('911 111 118') <> '+51911111118' then
    raise exception 'FAIL: teléfono peruano local no se normaliza';
  end if;
end $$;

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

insert into public.whatsapp_outbox (
  id, business_id, reservation_id, kind, recipient_e164,
  template_key, template_variables, status, attempts, locked_at
) values (
  '50000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000008',
  'customer_reminder',
  '+51911111118',
  'customer_reminder',
  '[]'::jsonb,
  'processing',
  1,
  now() - interval '10 minutes'
);

do $$
declare
  n integer;
begin
  select count(*) into n
  from public.phase8_claim_whatsapp_messages(20)
  where message_id = '50000000-0000-4000-8000-000000000008';

  if n <> 1 then
    raise exception 'FAIL: mensaje processing atascado no fue recuperado';
  end if;
end $$;

select public.phase8_complete_whatsapp_message(
  '50000000-0000-4000-8000-000000000008', false, null, 'test_retry'
);

update public.reservations
set start_at = ((current_date + 12) + time '18:00') at time zone 'America/Lima',
    end_at = ((current_date + 12) + time '19:00') at time zone 'America/Lima'
where id = '40000000-0000-4000-8000-000000000008';

do $$
declare
  reminder_available timestamptz;
  reservation_start timestamptz;
begin
  select available_at into reminder_available
  from public.whatsapp_outbox
  where id = '50000000-0000-4000-8000-000000000008';

  select start_at into reservation_start
  from public.reservations
  where id = '40000000-0000-4000-8000-000000000008';

  if reminder_available < reservation_start - interval '24 hours' - interval '1 minute'
     or reminder_available > reservation_start - interval '24 hours' + interval '1 minute' then
    raise exception 'FAIL: reminder reprogramado no sigue nueva fecha/hora';
  end if;
end $$;

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

do $$
declare
  reminder_status public.whatsapp_delivery_status;
begin
  select status into reminder_status
  from public.whatsapp_outbox
  where id = '50000000-0000-4000-8000-000000000008';

  if reminder_status <> 'skipped' then
    raise exception 'FAIL: reminder de reserva cancelada debe quedar skipped, obtuvo %', reminder_status;
  end if;
end $$;

insert into public.whatsapp_outbox (
  id, business_id, reservation_id, kind, recipient_e164,
  template_key, template_variables, status, attempts, locked_at
) values (
  '50000000-0000-4000-8000-000000000009',
  '10000000-0000-4000-8000-000000000001',
  null,
  'customer_reminder',
  '+51911111118',
  'customer_reminder',
  '[]'::jsonb,
  'processing',
  5,
  now() - interval '10 minutes'
);

select count(*) from public.phase8_claim_whatsapp_messages(20);

do $$
declare
  exhausted_status public.whatsapp_delivery_status;
  exhausted_locked timestamptz;
begin
  select status, locked_at into exhausted_status, exhausted_locked
  from public.whatsapp_outbox
  where id = '50000000-0000-4000-8000-000000000009';

  if exhausted_status <> 'failed' or exhausted_locked is not null then
    raise exception 'FAIL: lease agotado debe terminar failed y desbloqueado';
  end if;
end $$;

insert into public.whatsapp_outbox (
  id, business_id, reservation_id, kind, recipient_e164,
  template_key, template_variables, status, attempts, locked_at
) values (
  '50000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001',
  null,
  'customer_reminder',
  '+51911111118',
  'customer_reminder',
  '[]'::jsonb,
  'processing',
  2,
  now() - interval '10 minutes'
);

select count(*) from public.phase8_claim_whatsapp_messages(20);

do $$
declare
  missing_status public.whatsapp_delivery_status;
begin
  select status into missing_status
  from public.whatsapp_outbox
  where id = '50000000-0000-4000-8000-000000000010';

  if missing_status <> 'skipped' then
    raise exception 'FAIL: mensaje huérfano stale debe quedar skipped';
  end if;
end $$;

rollback;
\echo 'PASS phase8.sql · privacidad/E.164/outbox/idempotencia/recovery/transiciones/reminders'
