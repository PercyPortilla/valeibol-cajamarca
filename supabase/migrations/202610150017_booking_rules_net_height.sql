-- Valeibol · regla automática de iluminación, altura de red y exportación administrativa.
-- La iluminación deja de ser un input del cliente: se deriva únicamente desde la hora de inicio.
-- 07:00–17:59 => sin luz; >=18:00 => con luz. Los intervalos que cruzan 18:00 se rechazan.

alter table public.reservations
  add column if not exists net_height_cm smallint;

alter table public.reservations
  drop constraint if exists reservations_net_height_cm_check;

alter table public.reservations
  add constraint reservations_net_height_cm_check
  check (net_height_cm is null or net_height_cm between 180 and 250);

comment on column public.reservations.net_height_cm is
  'Altura de red solicitada, en centímetros. NULL solo preserva reservas históricas; nuevas reservas exigen un valor entre 180 y 250.';

create or replace function public.resolve_booking_lighting(
  p_start_time time,
  p_end_time time
)
returns public.lighting_mode
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    raise exception 'invalid_interval' using errcode = '22023';
  end if;

  if p_start_time < time '18:00' and p_end_time > time '18:00' then
    raise exception 'lighting_cutoff_crossed' using errcode = '22023';
  end if;

  return case
    when p_start_time >= time '18:00' then 'with_lights'::public.lighting_mode
    else 'without_lights'::public.lighting_mode
  end;
end;
$$;

revoke all on function public.resolve_booking_lighting(time, time) from public, anon, authenticated;

-- Retirar las firmas antiguas para que PostgREST/Edge no puedan seguir enviando lighting.
drop function if exists public.create_public_reservation_request(
  text, uuid, date, time, time, public.lighting_mode, text, text, boolean, uuid
);

create or replace function public.create_public_reservation_request(
  p_business_slug text,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_net_height_cm smallint,
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
  net_height_cm smallint,
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
  v_lighting public.lighting_mode;
begin
  if p_request_token is null then
    raise exception 'request_token_required' using errcode = '22023';
  end if;

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
      v_reservation.net_height_cm,
      v_reservation.hourly_rate,
      v_reservation.total_amount,
      b.currency
    from public.businesses b
    where b.id = v_reservation.business_id;
    return;
  end if;

  if p_net_height_cm is null or p_net_height_cm not between 180 and 250 then
    raise exception 'invalid_net_height' using errcode = '22023';
  end if;

  v_normalized_name := regexp_replace(trim(coalesce(p_customer_name, '')), '\\s+', ' ', 'g');
  v_normalized_phone := trim(coalesce(p_phone_e164, ''));

  if char_length(v_normalized_name) < 2 or char_length(v_normalized_name) > 120 then
    raise exception 'invalid_customer_name' using errcode = '22023';
  end if;
  if v_normalized_phone !~ '^\\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone_e164' using errcode = '22023';
  end if;
  if p_date is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    raise exception 'invalid_interval' using errcode = '22023';
  end if;

  v_lighting := public.resolve_booking_lighting(p_start_time, p_end_time);

  select b.* into v_business
  from public.businesses b
  where b.slug = p_business_slug and b.is_active
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
    and pr.lighting = v_lighting
    and pr.is_active
    and p_date >= pr.effective_from
    and (pr.effective_until is null or p_date <= pr.effective_until)
  order by pr.effective_from desc
  limit 1;
  if not found then
    raise exception 'pricing_not_found' using errcode = 'P0002';
  end if;

  insert into public.customers (
    business_id, full_name, phone_e164, marketing_opt_in, marketing_opt_in_at
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
      business_id, court_id, customer_id, start_at, end_at, status,
      lighting, net_height_cm, hourly_rate, total_amount, source, request_token
    ) values (
      v_business.id, v_court.id, v_customer_id, v_start_at, v_end_at, 'pending',
      v_lighting, p_net_height_cm, v_rate.hourly_rate,
      round(v_rate.hourly_rate * v_duration_minutes / 60.0, 2),
      'public_web', p_request_token
    )
    returning * into v_reservation;
  exception
    when exclusion_violation then
      raise exception 'slot_unavailable' using errcode = '23P01';
    when unique_violation then
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
    v_reservation.net_height_cm,
    v_reservation.hourly_rate,
    v_reservation.total_amount,
    v_business.currency;
end;
$$;

revoke all on function public.create_public_reservation_request(
  text, uuid, date, time, time, smallint, text, text, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.create_public_reservation_request(
  text, uuid, date, time, time, smallint, text, text, boolean, uuid
) to service_role;

drop function if exists public.admin_create_manual_reservation(
  uuid, date, time, time, public.lighting_mode, text, text, public.reservation_source
);

create or replace function public.admin_create_manual_reservation(
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_net_height_cm smallint,
  p_customer_name text,
  p_phone_e164 text,
  p_source public.reservation_source default 'admin'
)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  court_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  lighting public.lighting_mode,
  net_height_cm smallint,
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
  v_actor record;
  v_window record;
  v_rate public.pricing_rules%rowtype;
  v_customer_id uuid;
  v_reservation public.reservations%rowtype;
  v_name text;
  v_phone text;
  v_lighting public.lighting_mode;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if p_source is null or p_source = 'public_web' then
    raise exception 'invalid_admin_source' using errcode = '22023';
  end if;
  if p_net_height_cm is null or p_net_height_cm not between 180 and 250 then
    raise exception 'invalid_net_height' using errcode = '22023';
  end if;

  v_name := regexp_replace(trim(coalesce(p_customer_name, '')), '\\s+', ' ', 'g');
  v_phone := trim(coalesce(p_phone_e164, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_customer_name' using errcode = '22023';
  end if;
  if v_phone !~ '^\\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone_e164' using errcode = '22023';
  end if;

  select * into v_window
  from public.phase6_resolve_window(v_actor.business_id, p_court_id, p_date, p_start_time, p_end_time);
  v_lighting := public.resolve_booking_lighting(p_start_time, p_end_time);

  select pr.* into v_rate
  from public.pricing_rules pr
  where pr.court_id = p_court_id
    and pr.lighting = v_lighting
    and pr.is_active
    and p_date >= pr.effective_from
    and (pr.effective_until is null or p_date <= pr.effective_until)
  order by pr.effective_from desc
  limit 1;
  if not found then
    raise exception 'pricing_not_found' using errcode = 'P0002';
  end if;

  insert into public.customers (business_id, full_name, phone_e164)
  values (v_actor.business_id, v_name, v_phone)
  on conflict (business_id, phone_e164) where phone_e164 is not null and archived_at is null
  do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_customer_id;

  begin
    insert into public.reservations (
      business_id, court_id, customer_id, start_at, end_at, status,
      lighting, net_height_cm, hourly_rate, total_amount, source, created_by,
      last_modified_by, status_changed_at
    ) values (
      v_actor.business_id, p_court_id, v_customer_id,
      v_window.start_at, v_window.end_at, 'confirmed',
      v_lighting, p_net_height_cm, v_rate.hourly_rate,
      round(v_rate.hourly_rate * v_window.duration_minutes / 60.0, 2),
      p_source, v_actor.user_id, v_actor.user_id, now()
    ) returning * into v_reservation;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;

  return query select
    v_reservation.id, v_reservation.status, v_reservation.court_id,
    v_reservation.start_at, v_reservation.end_at, v_reservation.lighting,
    v_reservation.net_height_cm, v_reservation.hourly_rate,
    v_reservation.total_amount, v_actor.currency;
end;
$$;

revoke all on function public.admin_create_manual_reservation(
  uuid, date, time, time, smallint, text, text, public.reservation_source
) from public, anon, authenticated;
grant execute on function public.admin_create_manual_reservation(
  uuid, date, time, time, smallint, text, text, public.reservation_source
) to authenticated;

drop function if exists public.admin_edit_reservation(
  uuid, uuid, date, time, time, public.lighting_mode, text, text
);

create or replace function public.admin_edit_reservation(
  p_reservation_id uuid,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_net_height_cm smallint,
  p_customer_name text,
  p_phone_e164 text
)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  court_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  lighting public.lighting_mode,
  net_height_cm smallint,
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
  v_actor record;
  v_window record;
  v_rate public.pricing_rules%rowtype;
  v_customer_id uuid;
  v_reservation public.reservations%rowtype;
  v_name text;
  v_phone text;
  v_lighting public.lighting_mode;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role = 'staff' then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id and r.business_id = v_actor.business_id
  for update;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if v_reservation.status not in ('pending', 'confirmed') then
    raise exception 'reservation_not_editable' using errcode = '22023';
  end if;
  if p_net_height_cm is null or p_net_height_cm not between 180 and 250 then
    raise exception 'invalid_net_height' using errcode = '22023';
  end if;

  v_name := regexp_replace(trim(coalesce(p_customer_name, '')), '\\s+', ' ', 'g');
  v_phone := trim(coalesce(p_phone_e164, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_customer_name' using errcode = '22023';
  end if;
  if v_phone !~ '^\\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone_e164' using errcode = '22023';
  end if;

  select * into v_window
  from public.phase6_resolve_window(v_actor.business_id, p_court_id, p_date, p_start_time, p_end_time);
  v_lighting := public.resolve_booking_lighting(p_start_time, p_end_time);

  select pr.* into v_rate
  from public.pricing_rules pr
  where pr.court_id = p_court_id
    and pr.lighting = v_lighting
    and pr.is_active
    and p_date >= pr.effective_from
    and (pr.effective_until is null or p_date <= pr.effective_until)
  order by pr.effective_from desc
  limit 1;
  if not found then
    raise exception 'pricing_not_found' using errcode = 'P0002';
  end if;

  insert into public.customers (business_id, full_name, phone_e164)
  values (v_actor.business_id, v_name, v_phone)
  on conflict (business_id, phone_e164) where phone_e164 is not null and archived_at is null
  do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_customer_id;

  begin
    update public.reservations
    set court_id = p_court_id,
        customer_id = v_customer_id,
        start_at = v_window.start_at,
        end_at = v_window.end_at,
        lighting = v_lighting,
        net_height_cm = p_net_height_cm,
        hourly_rate = v_rate.hourly_rate,
        total_amount = round(v_rate.hourly_rate * v_window.duration_minutes / 60.0, 2),
        last_modified_by = v_actor.user_id
    where id = v_reservation.id
    returning * into v_reservation;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;

  return query select
    v_reservation.id, v_reservation.status, v_reservation.court_id,
    v_reservation.start_at, v_reservation.end_at, v_reservation.lighting,
    v_reservation.net_height_cm, v_reservation.hourly_rate,
    v_reservation.total_amount, v_actor.currency;
end;
$$;

revoke all on function public.admin_edit_reservation(
  uuid, uuid, date, time, time, smallint, text, text
) from public, anon, authenticated;
grant execute on function public.admin_edit_reservation(
  uuid, uuid, date, time, time, smallint, text, text
) to authenticated;

-- Lecturas administrativas: incorporar altura de red sin exponerla públicamente.
drop function if exists public.get_admin_reservation_requests(integer);

create function public.get_admin_reservation_requests(p_limit integer default 100)
returns table (
  reservation_id uuid,
  business_id uuid,
  court_id uuid,
  court_name text,
  customer_id uuid,
  customer_name text,
  customer_phone_e164 text,
  start_at timestamptz,
  end_at timestamptz,
  status public.reservation_status,
  lighting public.lighting_mode,
  net_height_cm smallint,
  hourly_rate numeric,
  total_amount numeric,
  currency text,
  source public.reservation_source,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select p.business_id into v_business_id
  from public.profiles p
  join public.businesses b on b.id = p.business_id and b.is_active
  where p.user_id = auth.uid()
    and p.is_active
    and p.role in ('owner', 'admin', 'staff')
  limit 1;
  if v_business_id is null then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 100), 200));
  return query
  select
    r.id, r.business_id, r.court_id, c.name, r.customer_id,
    cu.full_name, cu.phone_e164, r.start_at, r.end_at, r.status,
    r.lighting, r.net_height_cm, r.hourly_rate, r.total_amount,
    b.currency, r.source, r.created_at
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
  where r.business_id = v_business_id
  order by r.start_at desc, r.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.get_admin_reservation_requests(integer) from public, anon, authenticated;
grant execute on function public.get_admin_reservation_requests(integer) to authenticated;

drop function if exists public.get_admin_customer_history(uuid, integer);

create function public.get_admin_customer_history(
  p_customer_id uuid,
  p_limit integer default 100
)
returns table (
  reservation_id uuid,
  court_id uuid,
  court_name text,
  start_at timestamptz,
  end_at timestamptz,
  status public.reservation_status,
  lighting public.lighting_mode,
  net_height_cm smallint,
  hourly_rate numeric,
  total_amount numeric,
  source public.reservation_source,
  created_at timestamptz,
  updated_at timestamptz,
  currency text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_limit integer;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.business_id = v_actor.business_id and c.archived_at is null
  ) then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 100), 500));
  return query
  select
    r.id, r.court_id, c.name, r.start_at, r.end_at, r.status,
    r.lighting, r.net_height_cm, r.hourly_rate, r.total_amount, r.source,
    r.created_at, r.updated_at, v_actor.currency
  from public.reservations r
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  where r.business_id = v_actor.business_id
    and r.customer_id = p_customer_id
  order by r.start_at desc, r.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.get_admin_customer_history(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_admin_customer_history(uuid, integer) to authenticated;

-- Misma firma/return de agenda; solo se amplía el JSON interno con netHeightCm.
create or replace function public.get_admin_schedule(
  p_from date,
  p_to date
)
returns table (
  business_id uuid,
  booking_increment_minutes smallint,
  court_id uuid,
  court_name text,
  calendar_date date,
  is_open boolean,
  opens_at time,
  closes_at time,
  schedule_status public.configuration_status,
  entries jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 31 then
    raise exception 'invalid_date_range' using errcode = '22023';
  end if;
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  return query
  with dates as (
    select generate_series(p_from, p_to, interval '1 day')::date as calendar_date
  ),
  court_days as (
    select c.id as court_id, c.name as court_name, d.calendar_date,
      oh.is_open, oh.opens_at, oh.closes_at,
      coalesce(oh.configuration_status, c.configuration_status) as schedule_status
    from public.courts c
    cross join dates d
    left join lateral (
      select o.*
      from public.operating_hours o
      where o.court_id = c.id
        and o.weekday = extract(isodow from d.calendar_date)::smallint
        and d.calendar_date >= o.effective_from
        and (o.effective_until is null or d.calendar_date <= o.effective_until)
      order by o.effective_from desc
      limit 1
    ) oh on true
    where c.business_id = v_actor.business_id and c.is_active
  ),
  schedule_entries as (
    select
      r.court_id,
      (r.start_at at time zone v_actor.timezone)::date as calendar_date,
      jsonb_build_object(
        'entryKind', 'reservation',
        'id', r.id,
        'status', r.status,
        'startAt', r.start_at,
        'endAt', r.end_at,
        'customerName', cu.full_name,
        'customerPhoneE164', cu.phone_e164,
        'lighting', r.lighting,
        'netHeightCm', r.net_height_cm,
        'hourlyRate', r.hourly_rate,
        'totalAmount', r.total_amount,
        'currency', v_actor.currency,
        'source', r.source,
        'blockReason', null,
        'internalNote', null
      ) as payload,
      r.start_at as ordering_start
    from public.reservations r
    left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
    where r.business_id = v_actor.business_id
      and (r.start_at at time zone v_actor.timezone)::date between p_from and p_to

    union all

    select
      sb.court_id,
      (sb.start_at at time zone v_actor.timezone)::date as calendar_date,
      jsonb_build_object(
        'entryKind', 'block',
        'id', sb.id,
        'status', sb.status,
        'startAt', sb.start_at,
        'endAt', sb.end_at,
        'customerName', null,
        'customerPhoneE164', null,
        'lighting', null,
        'netHeightCm', null,
        'hourlyRate', null,
        'totalAmount', null,
        'currency', v_actor.currency,
        'source', null,
        'blockReason', sb.reason,
        'internalNote', sb.internal_note
      ) as payload,
      sb.start_at as ordering_start
    from public.schedule_blocks sb
    where sb.business_id = v_actor.business_id
      and (sb.start_at at time zone v_actor.timezone)::date between p_from and p_to
  )
  select
    v_actor.business_id,
    v_actor.booking_increment_minutes,
    cd.court_id,
    cd.court_name,
    cd.calendar_date,
    coalesce(cd.is_open, false),
    cd.opens_at,
    cd.closes_at,
    cd.schedule_status,
    coalesce((
      select jsonb_agg(se.payload order by se.ordering_start)
      from schedule_entries se
      where se.court_id = cd.court_id and se.calendar_date = cd.calendar_date
    ), '[]'::jsonb)
  from court_days cd
  order by cd.court_name, cd.calendar_date;
end;
$$;

-- Exportación masiva acotada a un año y exclusivamente owner/admin.
create or replace function public.get_admin_export_reservations(
  p_from date,
  p_to date
)
returns table (
  reservation_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone_e164 text,
  marketing_opt_in boolean,
  court_id uuid,
  court_name text,
  start_at timestamptz,
  end_at timestamptz,
  status public.reservation_status,
  lighting public.lighting_mode,
  net_height_cm smallint,
  hourly_rate numeric,
  total_amount numeric,
  currency text,
  source public.reservation_source,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
begin
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'invalid_date_range' using errcode = '22023';
  end if;
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  return query
  select
    r.id, r.customer_id, cu.full_name, cu.phone_e164,
    coalesce(cu.marketing_opt_in, false),
    r.court_id, c.name, r.start_at, r.end_at, r.status, r.lighting,
    r.net_height_cm, r.hourly_rate, r.total_amount, v_actor.currency,
    r.source, r.created_at, r.updated_at
  from public.reservations r
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
  where r.business_id = v_actor.business_id
    and (r.start_at at time zone v_actor.timezone)::date between p_from and p_to
  order by r.start_at, r.created_at;
end;
$$;

revoke all on function public.get_admin_export_reservations(date, date) from public, anon, authenticated;
grant execute on function public.get_admin_export_reservations(date, date) to authenticated;
