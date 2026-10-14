-- Valeibol · Fase 8
-- WhatsApp Business Platform: outbox transaccional, idempotencia y trazabilidad.
-- Los tokens/procesamiento viven fuera del navegador. Esta migración NO envía HTTP desde PostgreSQL.

do $$ begin
  create type public.whatsapp_message_kind as enum (
    'owner_new_request',
    'customer_confirmed',
    'customer_cancelled',
    'customer_reminder'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_delivery_status as enum (
    'pending',
    'processing',
    'sent',
    'failed',
    'skipped'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  kind public.whatsapp_message_kind not null,
  recipient_e164 text not null check (recipient_e164 ~ '^[+][1-9][0-9]{7,14}$'),
  template_key text not null check (template_key ~ '^[a-z0-9_]+$'),
  template_variables jsonb not null default '[]'::jsonb,
  status public.whatsapp_delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(template_variables) = 'array')
);

create unique index if not exists whatsapp_outbox_reservation_kind_unique
  on public.whatsapp_outbox (reservation_id, kind)
  where reservation_id is not null;

create index if not exists whatsapp_outbox_pending_idx
  on public.whatsapp_outbox (status, available_at, created_at)
  where status in ('pending', 'failed');

create index if not exists whatsapp_outbox_processing_idx
  on public.whatsapp_outbox (locked_at)
  where status = 'processing';

alter table public.whatsapp_outbox enable row level security;
revoke all on public.whatsapp_outbox from public, anon, authenticated;

drop trigger if exists whatsapp_outbox_set_updated_at on public.whatsapp_outbox;
create trigger whatsapp_outbox_set_updated_at
before update on public.whatsapp_outbox
for each row execute function public.set_updated_at();

create or replace function public.phase8_normalize_peru_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_digits text;
begin
  if p_phone is null or btrim(p_phone) = '' then
    return null;
  end if;

  if btrim(p_phone) ~ '^[+][1-9][0-9]{7,14}$' then
    return btrim(p_phone);
  end if;

  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if v_digits ~ '^9[0-9]{8}$' then
    return '+51' || v_digits;
  end if;
  if v_digits ~ '^519[0-9]{8}$' then
    return '+' || v_digits;
  end if;
  return null;
end;
$$;

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
        coalesce(v_business_name, 'Valeibol'),
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
        coalesce(v_business_name, 'Valeibol'),
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
after insert or update of status on public.reservations
for each row execute function public.phase8_queue_reservation_message();

create or replace function public.phase8_enqueue_due_reminders(
  p_window_start interval default interval '23 hours',
  p_window_end interval default interval '25 hours'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_window_start < interval '0' or p_window_end <= p_window_start or p_window_end > interval '7 days' then
    raise exception 'invalid_reminder_window' using errcode = '22023';
  end if;

  with candidates as (
    select
      r.id as reservation_id,
      r.business_id,
      public.phase8_normalize_peru_phone(cu.phone_e164) as recipient_e164,
      cu.full_name,
      b.name as business_name,
      c.name as court_name,
      to_char(r.start_at at time zone b.timezone, 'DD/MM/YYYY HH24:MI') as local_start
    from public.reservations r
    join public.businesses b on b.id = r.business_id and b.is_active
    join public.courts c on c.id = r.court_id and c.business_id = r.business_id
    join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
    where r.status = 'confirmed'
      and r.start_at >= now() + p_window_start
      and r.start_at < now() + p_window_end
  ), inserted as (
    insert into public.whatsapp_outbox (
      business_id, reservation_id, kind, recipient_e164, template_key, template_variables
    )
    select
      business_id,
      reservation_id,
      'customer_reminder',
      recipient_e164,
      'customer_reminder',
      jsonb_build_array(
        coalesce(full_name, 'Cliente'),
        coalesce(business_name, 'Valeibol'),
        coalesce(court_name, 'Cancha'),
        local_start
      )
    from candidates
    where recipient_e164 is not null
    on conflict (reservation_id, kind) where reservation_id is not null do nothing
    returning 1
  )
  select count(*) into v_count from inserted;

  return coalesce(v_count, 0);
end;
$$;

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

  return query
  with claimable as (
    select o.id
    from public.whatsapp_outbox o
    where (
        (o.status in ('pending', 'failed') and o.available_at <= now())
        or (
          o.status = 'processing'
          and o.locked_at is not null
          and o.locked_at <= now() - interval '5 minutes'
        )
      )
      and o.attempts < 5
    order by o.created_at, o.id
    for update skip locked
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

create or replace function public.phase8_complete_whatsapp_message(
  p_message_id uuid,
  p_sent boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.whatsapp_outbox
  set
    status = case when p_sent then 'sent'::public.whatsapp_delivery_status else 'failed'::public.whatsapp_delivery_status end,
    provider_message_id = case when p_sent then nullif(btrim(p_provider_message_id), '') else provider_message_id end,
    last_error = case when p_sent then null else left(coalesce(p_error, 'unknown_provider_error'), 1000) end,
    sent_at = case when p_sent then now() else sent_at end,
    locked_at = null,
    available_at = case
      when p_sent then available_at
      else now() + make_interval(mins => least(60, greatest(1, attempts * attempts)))
    end
  where id = p_message_id
    and status = 'processing';

  if not found then
    raise exception 'whatsapp_message_not_claimed' using errcode = 'P0002';
  end if;
end;
$$;

-- Nadie desde el navegador puede leer, reclamar o completar el outbox.
revoke all on function public.phase8_normalize_peru_phone(text) from public, anon, authenticated;
revoke all on function public.phase8_queue_reservation_message() from public, anon, authenticated;
revoke all on function public.phase8_enqueue_due_reminders(interval, interval) from public, anon, authenticated;
revoke all on function public.phase8_claim_whatsapp_messages(integer) from public, anon, authenticated;
revoke all on function public.phase8_complete_whatsapp_message(uuid, boolean, text, text) from public, anon, authenticated;

grant execute on function public.phase8_enqueue_due_reminders(interval, interval) to service_role;
grant execute on function public.phase8_claim_whatsapp_messages(integer) to service_role;
grant execute on function public.phase8_complete_whatsapp_message(uuid, boolean, text, text) to service_role;

comment on table public.whatsapp_outbox is
  'Outbox privado para notificaciones transaccionales de WhatsApp. Sin acceso anon/authenticated; un worker server-side con service_role procesa mensajes.';
