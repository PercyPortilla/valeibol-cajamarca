-- Valeibol · Fase 7
-- Clientes, precios versionados y métricas operativas reales.
-- Mantiene privacidad pública, negocio derivado desde auth.uid() y mínimo privilegio.

alter table public.pricing_rules
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists pricing_rules_active_lookup_idx
  on public.pricing_rules (court_id, lighting, effective_from, effective_until)
  where is_active;

-- Superficie pública sanitizada para consultar la tarifa aplicable a una fecha concreta.
-- No expone PII, perfiles, reservas ni datos administrativos.
create or replace function public.get_public_pricing_for_date(
  p_business_slug text,
  p_date date
)
returns table (
  business_id uuid,
  business_name text,
  currency text,
  timezone text,
  court_id uuid,
  court_name text,
  lighting public.lighting_mode,
  label text,
  hourly_rate numeric,
  effective_from date,
  effective_until date,
  configuration_status public.configuration_status
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
    c.id,
    c.name,
    pr.lighting,
    pr.label,
    pr.hourly_rate,
    pr.effective_from,
    pr.effective_until,
    pr.configuration_status
  from public.businesses b
  join public.courts c
    on c.business_id = b.id
   and c.is_active
  join public.pricing_rules pr
    on pr.court_id = c.id
   and pr.is_active
   and p_date >= pr.effective_from
   and (pr.effective_until is null or p_date <= pr.effective_until)
  where b.slug = p_business_slug
    and b.is_active
    and p_date is not null
  order by c.sort_order, c.name, pr.lighting;
$$;

-- Corrige las RPC públicas anteriores para usar la fecha local del negocio y no current_date del servidor.
create or replace function public.get_public_business_config(p_business_slug text)
returns table (
  business_id uuid,
  business_name text,
  short_name text,
  category text,
  city text,
  country text,
  address text,
  phone text,
  currency text,
  timezone text,
  configuration_status public.configuration_status,
  pricing jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.name,
    b.short_name,
    b.category,
    b.city,
    b.country,
    b.address,
    b.phone,
    b.currency,
    b.timezone,
    b.configuration_status,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'courtId', c.id,
          'courtName', c.name,
          'lighting', pr.lighting,
          'label', pr.label,
          'hourlyRate', pr.hourly_rate,
          'status', pr.configuration_status
        ) order by c.sort_order, pr.lighting
      ) filter (where pr.id is not null),
      '[]'::jsonb
    )
  from public.businesses b
  left join public.courts c on c.business_id = b.id and c.is_active
  left join public.pricing_rules pr
    on pr.court_id = c.id
   and pr.is_active
   and ((now() at time zone b.timezone)::date) >= pr.effective_from
   and (pr.effective_until is null or ((now() at time zone b.timezone)::date) <= pr.effective_until)
  where b.slug = p_business_slug
    and b.is_active
  group by b.id;
$$;

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
              and ((now() at time zone b.timezone)::date) >= pr.effective_from
              and (pr.effective_until is null or ((now() at time zone b.timezone)::date) <= pr.effective_until)
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

-- Clientes: lectura privada con agregados derivados exclusivamente de reservas reales.
create or replace function public.get_admin_customers(p_limit integer default 100)
returns table (
  customer_id uuid,
  full_name text,
  phone_e164 text,
  marketing_opt_in boolean,
  customer_created_at timestamptz,
  last_activity_at timestamptz,
  last_reservation_at timestamptz,
  reservation_count bigint,
  active_reservation_count bigint,
  completed_reservation_count bigint,
  cancelled_reservation_count bigint,
  confirmed_value numeric,
  completed_value numeric,
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

  v_limit := greatest(1, least(coalesce(p_limit, 100), 500));

  return query
  select
    c.id,
    c.full_name,
    c.phone_e164,
    c.marketing_opt_in,
    c.created_at,
    greatest(c.updated_at, coalesce(max(r.updated_at), c.updated_at)),
    max(r.start_at) filter (where r.status <> 'cancelled'),
    count(r.id),
    count(r.id) filter (where r.status in ('pending', 'confirmed')),
    count(r.id) filter (where r.status = 'completed'),
    count(r.id) filter (where r.status = 'cancelled'),
    coalesce(sum(r.total_amount) filter (where r.status = 'confirmed'), 0)::numeric,
    coalesce(sum(r.total_amount) filter (where r.status = 'completed'), 0)::numeric,
    v_actor.currency
  from public.customers c
  left join public.reservations r
    on r.customer_id = c.id
   and r.business_id = c.business_id
  where c.business_id = v_actor.business_id
    and c.archived_at is null
  group by c.id, c.full_name, c.phone_e164, c.marketing_opt_in, c.created_at, c.updated_at
  order by greatest(c.updated_at, coalesce(max(r.updated_at), c.updated_at)) desc, c.full_name
  limit v_limit;
end;
$$;

create or replace function public.get_admin_customer_history(
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
    r.id,
    r.court_id,
    c.name,
    r.start_at,
    r.end_at,
    r.status,
    r.lighting,
    r.hourly_rate,
    r.total_amount,
    r.source,
    r.created_at,
    r.updated_at,
    v_actor.currency
  from public.reservations r
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  where r.business_id = v_actor.business_id
    and r.customer_id = p_customer_id
  order by r.start_at desc, r.created_at desc
  limit v_limit;
end;
$$;

-- Tarifas: lectura versionada para todos los roles administrativos.
create or replace function public.get_admin_pricing_rules()
returns table (
  pricing_rule_id uuid,
  court_id uuid,
  court_name text,
  lighting public.lighting_mode,
  label text,
  hourly_rate numeric,
  effective_from date,
  effective_until date,
  is_active boolean,
  configuration_status public.configuration_status,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  is_current boolean,
  currency text,
  business_today date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_today date;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  v_today := (now() at time zone v_actor.timezone)::date;

  return query
  select
    pr.id,
    pr.court_id,
    c.name,
    pr.lighting,
    pr.label,
    pr.hourly_rate,
    pr.effective_from,
    pr.effective_until,
    pr.is_active,
    pr.configuration_status,
    pr.created_by,
    pr.created_at,
    pr.updated_at,
    (pr.is_active and v_today >= pr.effective_from and (pr.effective_until is null or v_today <= pr.effective_until)),
    v_actor.currency,
    v_today
  from public.pricing_rules pr
  join public.courts c on c.id = pr.court_id
  where c.business_id = v_actor.business_id
  order by c.sort_order, c.name, pr.lighting, pr.effective_from desc;
end;
$$;

-- Owner/Admin pueden programar una nueva versión; staff queda rechazado en PostgreSQL.
-- Nunca se modifica el hourly_rate de una versión histórica: se cierra su vigencia y se inserta otra fila.
create or replace function public.admin_schedule_pricing_rule(
  p_court_id uuid,
  p_lighting public.lighting_mode,
  p_hourly_rate numeric,
  p_effective_from date
)
returns table (
  pricing_rule_id uuid,
  court_id uuid,
  lighting public.lighting_mode,
  hourly_rate numeric,
  effective_from date,
  effective_until date,
  currency text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_today date;
  v_previous public.pricing_rules%rowtype;
  v_next public.pricing_rules%rowtype;
  v_inserted public.pricing_rules%rowtype;
  v_label text;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if p_court_id is null or p_lighting is null or p_effective_from is null then
    raise exception 'invalid_pricing_input' using errcode = '22023';
  end if;
  if p_hourly_rate is null or p_hourly_rate <= 0 or p_hourly_rate > 10000 then
    raise exception 'invalid_hourly_rate' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.courts c
    where c.id = p_court_id and c.business_id = v_actor.business_id and c.is_active
  ) then
    raise exception 'court_not_found' using errcode = 'P0002';
  end if;

  v_today := (now() at time zone v_actor.timezone)::date;
  if p_effective_from < v_today then
    raise exception 'pricing_effective_date_in_past' using errcode = '22023';
  end if;

  -- Serializa cambios de la misma cancha/modalidad para evitar carreras de versionado.
  perform pg_advisory_xact_lock(hashtext(p_court_id::text || ':' || p_lighting::text));

  if exists (
    select 1 from public.pricing_rules pr
    where pr.court_id = p_court_id
      and pr.lighting = p_lighting
      and pr.is_active
      and pr.effective_from = p_effective_from
  ) then
    raise exception 'pricing_effective_date_conflict' using errcode = '23P01';
  end if;

  select pr.* into v_previous
  from public.pricing_rules pr
  where pr.court_id = p_court_id
    and pr.lighting = p_lighting
    and pr.is_active
    and pr.effective_from < p_effective_from
    and (pr.effective_until is null or pr.effective_until >= p_effective_from)
  order by pr.effective_from desc
  limit 1
  for update;

  if found then
    update public.pricing_rules
    set effective_until = p_effective_from - 1,
        updated_at = now()
    where id = v_previous.id;
  end if;

  select pr.* into v_next
  from public.pricing_rules pr
  where pr.court_id = p_court_id
    and pr.lighting = p_lighting
    and pr.is_active
    and pr.effective_from > p_effective_from
  order by pr.effective_from asc
  limit 1
  for update;

  v_label := case p_lighting
    when 'without_lights' then 'Sin luz'
    when 'with_lights' then 'Con luz'
  end;

  insert into public.pricing_rules (
    court_id, lighting, label, hourly_rate, effective_from, effective_until,
    is_active, configuration_status, created_by
  ) values (
    p_court_id, p_lighting, v_label, round(p_hourly_rate, 2), p_effective_from,
    case when v_next.id is not null then v_next.effective_from - 1 else null end,
    true, 'confirmed', v_actor.user_id
  ) returning * into v_inserted;

  return query select
    v_inserted.id,
    v_inserted.court_id,
    v_inserted.lighting,
    v_inserted.hourly_rate,
    v_inserted.effective_from,
    v_inserted.effective_until,
    v_actor.currency;
exception
  when exclusion_violation then
    raise exception 'pricing_range_conflict' using errcode = '23P01';
end;
$$;

-- Métricas operativas: describen reservas/agenda, NO pagos cobrados.
create or replace function public.get_admin_operational_metrics(
  p_from date,
  p_to date
)
returns table (
  period_from date,
  period_to date,
  reservation_count bigint,
  pending_count bigint,
  confirmed_count bigint,
  completed_count bigint,
  cancelled_count bigint,
  pending_hours numeric,
  reserved_hours numeric,
  confirmed_value numeric,
  completed_value numeric,
  open_capacity_hours numeric,
  agenda_occupied_hours numeric,
  occupancy_percent numeric,
  currency text,
  timezone text
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

  return query
  with scoped_reservations as (
    select r.*
    from public.reservations r
    where r.business_id = v_actor.business_id
      and (r.start_at at time zone v_actor.timezone)::date between p_from and p_to
  ),
  reservation_metrics as (
    select
      count(*)::bigint as reservation_count,
      count(*) filter (where status = 'pending')::bigint as pending_count,
      count(*) filter (where status = 'confirmed')::bigint as confirmed_count,
      count(*) filter (where status = 'completed')::bigint as completed_count,
      count(*) filter (where status = 'cancelled')::bigint as cancelled_count,
      coalesce(sum(extract(epoch from (end_at - start_at)) / 3600.0) filter (where status = 'pending'), 0)::numeric as pending_hours,
      coalesce(sum(extract(epoch from (end_at - start_at)) / 3600.0) filter (where status in ('confirmed', 'completed')), 0)::numeric as reserved_hours,
      coalesce(sum(total_amount) filter (where status = 'confirmed'), 0)::numeric as confirmed_value,
      coalesce(sum(total_amount) filter (where status = 'completed'), 0)::numeric as completed_value
    from scoped_reservations
  ),
  dates as (
    select generate_series(p_from, p_to, interval '1 day')::date as d
  ),
  capacity as (
    select coalesce(sum(
      case
        when oh.is_open and oh.opens_at is not null and oh.closes_at is not null
          then extract(epoch from (oh.closes_at - oh.opens_at)) / 3600.0
        else 0
      end
    ), 0)::numeric as open_capacity_hours
    from public.courts c
    cross join dates d
    left join lateral (
      select o.*
      from public.operating_hours o
      where o.court_id = c.id
        and o.weekday = extract(isodow from d.d)::smallint
        and d.d >= o.effective_from
        and (o.effective_until is null or d.d <= o.effective_until)
      order by o.effective_from desc
      limit 1
    ) oh on true
    where c.business_id = v_actor.business_id and c.is_active
  ),
  occupied as (
    select coalesce(sum(extract(epoch from (e.end_at - e.start_at)) / 3600.0), 0)::numeric as agenda_occupied_hours
    from public.court_schedule_entries e
    where e.business_id = v_actor.business_id
      and e.blocks_availability
      and (e.start_at at time zone v_actor.timezone)::date between p_from and p_to
  )
  select
    p_from,
    p_to,
    rm.reservation_count,
    rm.pending_count,
    rm.confirmed_count,
    rm.completed_count,
    rm.cancelled_count,
    round(rm.pending_hours, 2),
    round(rm.reserved_hours, 2),
    round(rm.confirmed_value, 2),
    round(rm.completed_value, 2),
    round(c.open_capacity_hours, 2),
    round(o.agenda_occupied_hours, 2),
    case
      when c.open_capacity_hours > 0 then round(least(100, (o.agenda_occupied_hours / c.open_capacity_hours) * 100), 2)
      else 0
    end,
    v_actor.currency,
    v_actor.timezone
  from reservation_metrics rm
  cross join capacity c
  cross join occupied o;
end;
$$;

-- Privilegios: nunca abrir tablas directamente a anon. Fase 7 usa RPCs específicas.
revoke all on function public.get_public_pricing_for_date(text, date) from public;
grant execute on function public.get_public_pricing_for_date(text, date) to anon, authenticated;

revoke all on function public.get_admin_customers(integer) from public, anon, authenticated;
revoke all on function public.get_admin_customer_history(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_admin_pricing_rules() from public, anon, authenticated;
revoke all on function public.admin_schedule_pricing_rule(uuid, public.lighting_mode, numeric, date) from public, anon, authenticated;
revoke all on function public.get_admin_operational_metrics(date, date) from public, anon, authenticated;

grant execute on function public.get_admin_customers(integer) to authenticated;
grant execute on function public.get_admin_customer_history(uuid, integer) to authenticated;
grant execute on function public.get_admin_pricing_rules() to authenticated;
grant execute on function public.admin_schedule_pricing_rule(uuid, public.lighting_mode, numeric, date) to authenticated;
grant execute on function public.get_admin_operational_metrics(date, date) to authenticated;

revoke all on public.customers, public.reservations, public.profiles from anon;
revoke insert, update, delete on public.pricing_rules from authenticated;
