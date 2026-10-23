-- Bloque 8 · robustez WhatsApp transaccional.
-- Mantiene el outbox privado, evita recordatorios obsoletos y cierra leases agotados.

create or replace function public.phase8_queue_reservation_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_phone text;
  v_customer_phone text;
  v_customer_name text;
  v_court_name text;
  v_business_name text;
  v_local_start text;
begin
  select
    public.phase8_normalize_peru_phone(b.phone),
    b.name,
    c.name,
    to_char(new.start_at at time zone b.timezone, 'DD/MM/YYYY HH24:MI')
  into v_business_phone, v_business_name, v_court_name, v_local_start
  from public.businesses b
  join public.courts c on c.id = new.court_id and c.business_id = b.id
  where b.id = new.business_id;

  if new.customer_id is not null then
    select public.phase8_normalize_peru_phone(cu.phone_e164), cu.full_name
    into v_customer_phone, v_customer_name
    from public.customers cu
    where cu.id = new.customer_id and cu.business_id = new.business_id;
  end if;

  -- Si una reserva ya tenía mensajes aún no enviados y cambia de datos,
  -- refrescamos destinatario/variables con la fuente autoritativa actual.
  if tg_op = 'UPDATE' then
    if v_business_phone is not null then
      update public.whatsapp_outbox
      set recipient_e164 = v_business_phone,
          template_variables = jsonb_build_array(
            coalesce(v_customer_name, 'Cliente'),
            coalesce(v_court_name, 'Cancha'),
            v_local_start,
            new.id::text
          ),
          updated_at = now()
      where reservation_id = new.id
        and kind = 'owner_new_request'
        and status in ('pending', 'failed');
    end if;

    if v_customer_phone is not null then
      update public.whatsapp_outbox
      set recipient_e164 = v_customer_phone,
          template_variables = jsonb_build_array(
            coalesce(v_customer_name, 'Cliente'),
            coalesce(v_business_name, 'Negocio'),
            coalesce(v_court_name, 'Cancha'),
            v_local_start
          ),
          available_at = case
            when kind = 'customer_reminder'
              then greatest(now(), new.start_at - interval '24 hours')
            else available_at
          end,
          updated_at = now()
      where reservation_id = new.id
        and kind in ('customer_confirmed', 'customer_reminder')
        and status in ('pending', 'failed');
    end if;

    if new.status <> 'confirmed' then
      update public.whatsapp_outbox
      set status = 'skipped',
          last_error = 'reservation_no_longer_confirmed',
          locked_at = null,
          updated_at = now()
      where reservation_id = new.id
        and kind = 'customer_reminder'
        and status in ('pending', 'failed');
    end if;
  end if;

  if tg_op = 'INSERT' and new.status = 'pending' and new.source = 'public_web' and v_business_phone is not null then
    insert into public.whatsapp_outbox (
      business_id, reservation_id, kind, recipient_e164, template_key, template_variables
    )
    values (
      new.business_id,
      new.id,
      'owner_new_request',
      v_business_phone,
      'owner_new_request',
      jsonb_build_array(
        coalesce(v_customer_name, 'Cliente'),
        coalesce(v_court_name, 'Cancha'),
        v_local_start,
        new.id::text
      )
    )
    on conflict (reservation_id, kind) where reservation_id is not null do nothing;
  end if;

  if (
    (tg_op = 'INSERT' and new.status = 'confirmed')
    or
    (tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'confirmed')
  ) and v_customer_phone is not null then
    insert into public.whatsapp_outbox (
      business_id, reservation_id, kind, recipient_e164, template_key, template_variables
    )
    values (
      new.business_id,
      new.id,
      'customer_confirmed',
      v_customer_phone,
      'customer_confirmed',
      jsonb_build_array(
        coalesce(v_customer_name, 'Cliente'),
        coalesce(v_business_name, 'Negocio'),
        coalesce(v_court_name, 'Cancha'),
        v_local_start
      )
    )
    on conflict (reservation_id, kind) where reservation_id is not null do nothing;
  end if;

  if (
    tg_op = 'UPDATE'
    and old.status is distinct from new.status
    and new.status = 'cancelled'
    and v_customer_phone is not null
  ) then
    insert into public.whatsapp_outbox (
      business_id, reservation_id, kind, recipient_e164, template_key, template_variables
    )
    values (
      new.business_id,
      new.id,
      'customer_cancelled',
      v_customer_phone,
      'customer_cancelled',
      jsonb_build_array(
        coalesce(v_customer_name, 'Cliente'),
        coalesce(v_business_name, 'Negocio'),
        coalesce(v_court_name, 'Cancha'),
        v_local_start
      )
    )
    on conflict (reservation_id, kind) where reservation_id is not null do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_phase8_whatsapp_outbox on public.reservations;
create trigger reservations_phase8_whatsapp_outbox
after insert or update of status, start_at, end_at, court_id, customer_id on public.reservations
for each row execute function public.phase8_queue_reservation_message();

create or replace function public.phase8_claim_whatsapp_messages(p_limit integer default 20)
returns table (
  message_id uuid,
  kind public.whatsapp_message_kind,
  recipient_e164 text,
  template_key text,
  template_variables jsonb,
  attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_claim_limit' using errcode = '22023';
  end if;

  -- Un lease perdido en el quinto intento no puede quedar processing para siempre.
  update public.whatsapp_outbox
  set status = 'failed',
      last_error = coalesce(last_error, 'processor_lease_expired_after_max_attempts'),
      locked_at = null,
      updated_at = now()
  where status = 'processing'
    and attempts >= 5
    and locked_at is not null
    and locked_at <= now() - interval '5 minutes';

  -- Invalida mensajes cuyo estado de reserva ya cambió antes de enviarse.
  update public.whatsapp_outbox o
  set status = 'skipped',
      last_error = 'reservation_state_changed_before_delivery',
      locked_at = null,
      updated_at = now()
  from public.reservations r
  where o.reservation_id = r.id
    and (
      o.status in ('pending', 'failed')
      or (
        o.status = 'processing'
        and o.locked_at is not null
        and o.locked_at <= now() - interval '5 minutes'
      )
    )
    and (
      (o.kind = 'owner_new_request' and r.status <> 'pending')
      or (o.kind = 'customer_confirmed' and r.status <> 'confirmed')
      or (o.kind = 'customer_cancelled' and r.status <> 'cancelled')
      or (o.kind = 'customer_reminder' and (r.status <> 'confirmed' or r.start_at <= now()))
    );

  -- Si la reserva desapareció, la fila ya no tiene contexto autoritativo para enviar PII.
  update public.whatsapp_outbox o
  set status = 'skipped',
      last_error = 'reservation_missing_before_delivery',
      locked_at = null,
      updated_at = now()
  where o.reservation_id is null
    and (
      o.status in ('pending', 'failed')
      or (
        o.status = 'processing'
        and o.locked_at is not null
        and o.locked_at <= now() - interval '5 minutes'
      )
    );

  return query
  with claimable as (
    select o.id
    from public.whatsapp_outbox o
    join public.reservations r on r.id = o.reservation_id
    where (
        (o.status in ('pending', 'failed') and o.available_at <= now())
        or (
          o.status = 'processing'
          and o.locked_at is not null
          and o.locked_at <= now() - interval '5 minutes'
        )
      )
      and o.attempts < 5
      and (
        (o.kind = 'owner_new_request' and r.status = 'pending')
        or (o.kind = 'customer_confirmed' and r.status = 'confirmed')
        or (o.kind = 'customer_cancelled' and r.status = 'cancelled')
        or (o.kind = 'customer_reminder' and r.status = 'confirmed' and r.start_at > now())
      )
    order by o.created_at, o.id
    for update of o skip locked
    limit p_limit
  )
  update public.whatsapp_outbox o
  set
    status = 'processing',
    attempts = o.attempts + 1,
    locked_at = now(),
    last_error = null
  from claimable c
  where o.id = c.id
  returning o.id, o.kind, o.recipient_e164, o.template_key, o.template_variables, o.attempts;
end;
$$;

revoke all on function public.phase8_queue_reservation_message() from public, anon, authenticated;
revoke all on function public.phase8_claim_whatsapp_messages(integer) from public, anon, authenticated;
grant execute on function public.phase8_claim_whatsapp_messages(integer) to service_role;
