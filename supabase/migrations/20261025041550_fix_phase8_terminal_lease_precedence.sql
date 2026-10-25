-- Conserva como terminales los leases agotados del outbox WhatsApp.
-- Una vez que attempts >= 5 convierte processing -> failed, las limpiezas de
-- contexto obsoleto no deben reescribir ese estado terminal como skipped.

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

  -- Quinto intento vencido: estado terminal. No debe volver a skipped.
  update public.whatsapp_outbox o
  set status = 'failed',
      last_error = coalesce(o.last_error, 'processor_lease_expired_after_max_attempts'),
      locked_at = null,
      updated_at = now()
  where o.status = 'processing'
    and o.attempts >= 5
    and o.locked_at is not null
    and o.locked_at <= now() - interval '5 minutes';

  -- Solo mensajes todavía reintentables pueden invalidarse por cambio de estado.
  update public.whatsapp_outbox o
  set status = 'skipped',
      last_error = 'reservation_state_changed_before_delivery',
      locked_at = null,
      updated_at = now()
  from public.reservations r
  where o.reservation_id = r.id
    and o.attempts < 5
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

  -- Igual para huérfanos: solo se descartan mientras sigan siendo reintentables.
  update public.whatsapp_outbox o
  set status = 'skipped',
      last_error = 'reservation_missing_before_delivery',
      locked_at = null,
      updated_at = now()
  where o.reservation_id is null
    and o.attempts < 5
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
  set status = 'processing',
      attempts = o.attempts + 1,
      locked_at = now(),
      last_error = null
  from claimable c
  where o.id = c.id
  returning o.id, o.kind, o.recipient_e164, o.template_key, o.template_variables, o.attempts;
end;
$$;

revoke all on function public.phase8_claim_whatsapp_messages(integer) from public, anon, authenticated;
grant execute on function public.phase8_claim_whatsapp_messages(integer) to service_role;

comment on function public.phase8_claim_whatsapp_messages(integer) is
  'Mantiene failed como estado terminal tras 5 intentos; solo mensajes reintentables pueden invalidarse como skipped.';
