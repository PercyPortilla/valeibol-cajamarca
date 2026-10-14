-- Valeibol · Fase 4
-- Solicitud pública de reserva segura y transaccional.
-- Política: las solicitudes PENDING bloquean disponibilidad inmediatamente.
-- Motivo: evita vender dos veces el mismo intervalo mientras el propietario decide.
-- La futura confirmación/cancelación administrativa conservará/liberará el ledger por los triggers de Fase 3.

alter table public.businesses
  add column if not exists booking_increment_minutes smallint not null default 60
  check (booking_increment_minutes between 15 and 240 and 1440 % booking_increment_minutes = 0);

alter table public.reservations
  add column if not exists request_token uuid;

create unique index if not exists reservations_request_token_unique
  on public.reservations (request_token)
  where request_token is not null;

comment on column public.businesses.booking_increment_minutes is
  'Granularidad mínima de reserva. Valeibol usa 60 minutos mientras el horario real permanece provisional.';
comment on column public.reservations.request_token is
  'Token idempotente generado por el cliente para reintentos seguros de solicitudes públicas.';

create or replace function public.get_public_booking_context(p_business_slug text)
returns table (
  business_id uuid,
  business_name text,
  currency text,
  timezone text,
  booking_increment_minutes smallint,
  courts jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.name,
    b.currency,
    b.timezone,
    b.booking_increment_minutes,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'courtId', c.id,
          'courtName', c.name,
          'pricing', (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'lighting', pr.lighting,
                  'label', pr.label,
                  'hourlyRate', pr.hourly_rate,
                  'status', pr.configuration_status
                ) order by pr.lighting
              ),
              '[]'::jsonb
            )
            from public.pricing_rules pr
            where pr.court_id = c.id
              and pr.is_active
              and current_date >= pr.effective_from
              and (pr.effective_until is null or current_date <= pr.effective_until)
          )
        ) order by c.sort_order, c.name
      ) filter (where c.id is not null),
      '[]'::jsonb
    )
  from public.businesses b
  left join public.courts c
    on c.business_id = b.id
   and c.is_active
  where b.slug = p_business_slug
    and b.is_active
  group by b.id;
$$;

-- Única vía anónima para persistir una solicitud.
-- No recibe precio ni total: ambos se resuelven dentro de la base de datos.
create or replace function public.create_public_reservation_request(
  p_business_slug text,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_lighting public.lighting_mode,
  p_customer_name text,
  p_phone_e164 text,
  p_marketing_opt_in boolean default false,
  p_request_token uuid default gen_random_uuid()
)
returns table (
  request_id uuid,
  request_status public.reservation_status,
  court_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  lighting public.lighting_mode,
  hourly_rate numeric,
  total_amount numeric,
  currency text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_court public.courts%rowtype;
  v_hours public.operating_hours%rowtype;
  v_rate public.pricing_rules%rowtype;
  v_customer_id uuid;
  v_reservation public.reservations%rowtype;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_duration_minutes numeric;
  v_start_offset_minutes numeric;
  v_normalized_name text;
  v_normalized_phone text;
begin
  if p_request_token is null then
    raise exception 'request_token_required' using errcode = '22023';
  end if;

  -- Idempotencia: un reintento con el mismo token devuelve la solicitud previa sin duplicarla.
  select r.* into v_reservation
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  where r.request_token = p_request_token
    and b.slug = p_business_slug
  limit 1;

  if found then
    return query
    select
      v_reservation.id,
      v_reservation.status,
      v_reservation.court_id,
      v_reservation.start_at,
      v_reservation.end_at,
      v_reservation.lighting,
      v_reservation.hourly_rate,
      v_reservation.total_amount,
      b.currency
    from public.businesses b
    where b.id = v_reservation.business_id;
    return;
  end if;

  v_normalized_name := regexp_replace(trim(coalesce(p_customer_name, '')), '\s+', ' ', 'g');
  v_normalized_phone := trim(coalesce(p_phone_e164, ''));

  if char_length(v_normalized_name) < 2 or char_length(v_normalized_name) > 120 then
    raise exception 'invalid_customer_name' using errcode = '22023';
  end if;

  if v_normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone_e164' using errcode = '22023';
  end if;

  if p_date is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    raise exception 'invalid_interval' using errcode = '22023';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.slug = p_business_slug
    and b.is_active
  for share;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  select c.* into v_court
  from public.courts c
  where c.id = p_court_id
    and c.business_id = v_business.id
    and c.is_active
  for share;

  if not found then
    raise exception 'court_not_found' using errcode = 'P0002';
  end if;

  select oh.* into v_hours
  from public.operating_hours oh
  where oh.court_id = v_court.id
    and oh.weekday = extract(isodow from p_date)::smallint
    and p_date >= oh.effective_from
    and (oh.effective_until is null or p_date <= oh.effective_until)
  order by oh.effective_from desc
  limit 1;

  if not found or not v_hours.is_open or v_hours.opens_at is null or v_hours.closes_at is null then
    raise exception 'court_closed' using errcode = '22023';
  end if;

  if p_start_time < v_hours.opens_at or p_end_time > v_hours.closes_at then
    raise exception 'outside_operating_hours' using errcode = '22023';
  end if;

  v_duration_minutes := extract(epoch from (p_end_time - p_start_time)) / 60.0;
  v_start_offset_minutes := extract(epoch from (p_start_time - v_hours.opens_at)) / 60.0;

  if v_duration_minutes <= 0
     or mod(v_duration_minutes::numeric, v_business.booking_increment_minutes::numeric) <> 0
     or mod(v_start_offset_minutes::numeric, v_business.booking_increment_minutes::numeric) <> 0 then
    raise exception 'invalid_booking_increment' using errcode = '22023';
  end if;

  v_start_at := (p_date + p_start_time) at time zone v_business.timezone;
  v_end_at := (p_date + p_end_time) at time zone v_business.timezone;

  if v_start_at <= now() then
    raise exception 'reservation_in_past' using errcode = '22023';
  end if;

  select pr.* into v_rate
  from public.pricing_rules pr
  where pr.court_id = v_court.id
    and pr.lighting = p_lighting
    and pr.is_active
    and p_date >= pr.effective_from
    and (pr.effective_until is null or p_date <= pr.effective_until)
  order by pr.effective_from desc
  limit 1;

  if not found then
    raise exception 'pricing_not_found' using errcode = 'P0002';
  end if;

  -- Upsert mínimo del cliente. La API pública jamás obtiene lectura de esta tabla.
  insert into public.customers (
    business_id,
    full_name,
    phone_e164,
    marketing_opt_in,
    marketing_opt_in_at
  ) values (
    v_business.id,
    v_normalized_name,
    v_normalized_phone,
    coalesce(p_marketing_opt_in, false),
    case when coalesce(p_marketing_opt_in, false) then now() else null end
  )
  on conflict (business_id, phone_e164) where phone_e164 is not null and archived_at is null
  do update set
    full_name = excluded.full_name,
    marketing_opt_in = public.customers.marketing_opt_in or excluded.marketing_opt_in,
    marketing_opt_in_at = case
      when public.customers.marketing_opt_in then public.customers.marketing_opt_in_at
      when excluded.marketing_opt_in then excluded.marketing_opt_in_at
      else null
    end,
    updated_at = now()
  returning id into v_customer_id;

  begin
    insert into public.reservations (
      business_id,
      court_id,
      customer_id,
      start_at,
      end_at,
      status,
      lighting,
      hourly_rate,
      total_amount,
      source,
      request_token
    ) values (
      v_business.id,
      v_court.id,
      v_customer_id,
      v_start_at,
      v_end_at,
      'pending',
      p_lighting,
      v_rate.hourly_rate,
      round(v_rate.hourly_rate * v_duration_minutes / 60.0, 2),
      'public_web',
      p_request_token
    )
    returning * into v_reservation;
  exception
    when exclusion_violation then
      -- El trigger de Fase 3 inserta en court_schedule_entries y la EXCLUDE constraint
      -- serializa la carrera: dos solicitudes simultáneas al mismo intervalo => máximo una.
      raise exception 'slot_unavailable' using errcode = '23P01';
    when unique_violation then
      -- Un retry del mismo request_token puede haber ganado la carrera en otra transacción.
      select r.* into v_reservation
      from public.reservations r
      where r.request_token = p_request_token
      limit 1;

      if not found then
        raise;
      end if;
  end;

  return query
  select
    v_reservation.id,
    v_reservation.status,
    v_reservation.court_id,
    v_reservation.start_at,
    v_reservation.end_at,
    v_reservation.lighting,
    v_reservation.hourly_rate,
    v_reservation.total_amount,
    v_business.currency;
end;
$$;

-- La función pública es la única superficie anónima de escritura.
revoke all on function public.get_public_booking_context(text) from public;
revoke all on function public.create_public_reservation_request(
  text, uuid, date, time, time, public.lighting_mode, text, text, boolean, uuid
) from public;

grant execute on function public.get_public_booking_context(text) to anon, authenticated;
grant execute on function public.create_public_reservation_request(
  text, uuid, date, time, time, public.lighting_mode, text, text, boolean, uuid
) to anon, authenticated;

-- Mantener tablas sensibles cerradas al rol anónimo aun después de la nueva función.
revoke all on public.customers, public.reservations, public.schedule_blocks, public.court_schedule_entries from anon;
