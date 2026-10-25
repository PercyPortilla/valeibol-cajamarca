-- Bloque 22 · gestión versionada del horario regular por cancha.
-- Mantiene historia, preserva versiones futuras y serializa cambios contra reservas.

create or replace function public.get_admin_business_structure()
returns table (
  business_id uuid,
  business_slug text,
  business_name text,
  city text,
  country text,
  address text,
  phone text,
  currency text,
  timezone text,
  configuration_status public.configuration_status,
  sports jsonb,
  venues jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.slug,
    b.name,
    b.city,
    b.country,
    b.address,
    b.phone,
    b.currency,
    b.timezone,
    b.configuration_status,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('sportId', s.id, 'slug', s.slug, 'name', s.name)
        order by s.sort_order, s.name
      )
      from public.sports s
      where s.is_active
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'venueId', v.id,
          'slug', v.slug,
          'name', v.name,
          'city', v.city,
          'address', v.address,
          'latitude', v.latitude,
          'longitude', v.longitude,
          'isActive', v.is_active,
          'courts', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'courtId', c.id,
                'slug', c.slug,
                'name', c.name,
                'surface', c.surface,
                'sportId', s.id,
                'sportSlug', s.slug,
                'sportName', s.name,
                'isActive', c.is_active,
                'hoursConfigured', (
                  select count(distinct oh.weekday) = 7
                  from public.operating_hours oh
                  where oh.court_id = c.id
                    and (now() at time zone b.timezone)::date >= oh.effective_from
                    and (oh.effective_until is null or (now() at time zone b.timezone)::date <= oh.effective_until)
                ),
                'pricingConfigured', (
                  select count(distinct pr.lighting) = 2
                  from public.pricing_rules pr
                  where pr.court_id = c.id
                    and pr.is_active
                    and (now() at time zone b.timezone)::date >= pr.effective_from
                    and (pr.effective_until is null or (now() at time zone b.timezone)::date <= pr.effective_until)
                ),
                'operatingHours', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'weekday', oh.weekday,
                      'isOpen', oh.is_open,
                      'opensAt', oh.opens_at,
                      'closesAt', oh.closes_at,
                      'effectiveFrom', oh.effective_from,
                      'effectiveUntil', oh.effective_until,
                      'configurationStatus', oh.configuration_status
                    ) order by oh.effective_from, oh.weekday
                  )
                  from public.operating_hours oh
                  where oh.court_id = c.id
                    and (oh.effective_until is null or oh.effective_until >= (now() at time zone b.timezone)::date)
                ), '[]'::jsonb)
              ) order by c.sort_order, c.name
            )
            from public.courts c
            join public.sports s on s.id = c.sport_id
            where c.business_id = b.id and c.venue_id = v.id
          ), '[]'::jsonb)
        ) order by v.sort_order, v.name
      )
      from public.venues v
      where v.business_id = b.id
    ), '[]'::jsonb)
  from public.businesses b
  where b.id = v_actor.business_id;
end;
$$;

create or replace function public.admin_schedule_court_operating_hours(
  p_court_id uuid,
  p_hours jsonb,
  p_effective_from date
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_business public.businesses%rowtype;
  v_court public.courts%rowtype;
  v_today date;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if p_court_id is null or p_effective_from is null
     or jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) <> 7 then
    raise exception 'invalid_weekly_hours' using errcode = '22023';
  end if;

  -- Valida la forma JSON antes de cualquier cast a smallint/boolean/time para
  -- que un payload malicioso siempre termine en un error de dominio estable.
  if (select count(distinct item->>'weekday') from jsonb_array_elements(p_hours) item) <> 7
     or exists (
       select 1
       from jsonb_array_elements(p_hours) item
       where coalesce(jsonb_typeof(item), 'null') <> 'object'
          or coalesce(jsonb_typeof(item->'weekday'), 'null') <> 'number'
          or (item->>'weekday') !~ '^[1-7]$'
          or coalesce(jsonb_typeof(item->'is_open'), 'null') <> 'boolean'
          or not (item ? 'opens_at')
          or not (item ? 'closes_at')
          or (
            item->>'is_open' = 'true' and (
              coalesce(jsonb_typeof(item->'opens_at'), 'null') <> 'string'
              or coalesce(jsonb_typeof(item->'closes_at'), 'null') <> 'string'
              or (item->>'opens_at') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
              or (item->>'closes_at') !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
              or case
                when (item->>'opens_at') ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
                 and (item->>'closes_at') ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
                then (item->>'opens_at')::time >= (item->>'closes_at')::time
                else false
              end
            )
          )
          or (
            item->>'is_open' = 'false'
            and (
              coalesce(jsonb_typeof(item->'opens_at'), 'null') <> 'null'
              or coalesce(jsonb_typeof(item->'closes_at'), 'null') <> 'null'
            )
          )
     ) then
    raise exception 'invalid_weekly_hours' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text)
    where x.is_open
  ) then
    raise exception 'at_least_one_open_day_required' using errcode = '22023';
  end if;

  -- B22 y B23 comparten esta fila como frontera de serialización. Así un
  -- cambio de horario no puede validarse contra un booking_increment antiguo
  -- mientras B23 valida el incremento contra un horario antiguo.
  select b.* into v_business
  from public.businesses b
  where b.id = v_actor.business_id
    and b.is_active
  for update;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  v_today := (now() at time zone v_business.timezone)::date;
  if p_effective_from <= v_today then
    raise exception 'operating_hours_effective_date_not_future' using errcode = '22023';
  end if;

  -- Booking toma business -> court FOR SHARE. B22 conserva el mismo orden:
  -- business -> court, evitando write-skew con B23 y ciclos de locks.
  select c.* into v_court
  from public.courts c
  where c.id = p_court_id
    and c.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'court_not_found' using errcode = 'P0002';
  end if;

  -- No bloqueamos filas de reservations/schedule_blocks: admin_edit_reservation toma
  -- reservation -> court, y hacerlo aquí en orden inverso introduciría un ciclo de locks.
  if exists (
    with proposed as (
      select
        x.weekday,
        x.is_open,
        case when x.is_open then x.opens_at::time else null end as opens_at,
        case when x.is_open then x.closes_at::time else null end as closes_at,
        case
          when exact_row.id is not null then exact_row.effective_until
          when next_row.effective_from is not null then next_row.effective_from - 1
          else null
        end as effective_until
      from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text)
      left join lateral (
        select oh.id, oh.effective_until
        from public.operating_hours oh
        where oh.court_id = p_court_id
          and oh.weekday = x.weekday
          and oh.effective_from = p_effective_from
        limit 1
      ) exact_row on true
      left join lateral (
        select oh.effective_from
        from public.operating_hours oh
        where oh.court_id = p_court_id
          and oh.weekday = x.weekday
          and oh.effective_from > p_effective_from
        order by oh.effective_from
        limit 1
      ) next_row on true
    ), active_reservations as (
      select
        r.*,
        (r.start_at at time zone v_business.timezone) as local_start,
        (r.end_at at time zone v_business.timezone) as local_end
      from public.reservations r
      where r.business_id = v_actor.business_id
        and r.court_id = p_court_id
        and r.status in ('pending', 'confirmed')
        and r.end_at > now()
    )
    select 1
    from active_reservations r
    join proposed p on p.weekday = extract(isodow from r.local_start)::smallint
    where r.local_start::date >= p_effective_from
      and (p.effective_until is null or r.local_start::date <= p.effective_until)
      and (
        r.local_start::date <> r.local_end::date
        or not p.is_open
        or r.local_start::time < p.opens_at
        or r.local_end::time > p.closes_at
        or mod((extract(epoch from (r.local_end::time - r.local_start::time)) / 60.0)::numeric, v_business.booking_increment_minutes::numeric) <> 0
        or mod((extract(epoch from (r.local_start::time - p.opens_at)) / 60.0)::numeric, v_business.booking_increment_minutes::numeric) <> 0
      )
    limit 1
  ) then
    raise exception 'operating_hours_conflict_future_reservations' using errcode = '22023';
  end if;

  if exists (
    with proposed as (
      select
        x.weekday,
        x.is_open,
        case when x.is_open then x.opens_at::time else null end as opens_at,
        case when x.is_open then x.closes_at::time else null end as closes_at,
        case
          when exact_row.id is not null then exact_row.effective_until
          when next_row.effective_from is not null then next_row.effective_from - 1
          else null
        end as effective_until
      from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text)
      left join lateral (
        select oh.id, oh.effective_until
        from public.operating_hours oh
        where oh.court_id = p_court_id
          and oh.weekday = x.weekday
          and oh.effective_from = p_effective_from
        limit 1
      ) exact_row on true
      left join lateral (
        select oh.effective_from
        from public.operating_hours oh
        where oh.court_id = p_court_id
          and oh.weekday = x.weekday
          and oh.effective_from > p_effective_from
        order by oh.effective_from
        limit 1
      ) next_row on true
    ), active_blocks as (
      select
        sb.*,
        (sb.start_at at time zone v_business.timezone) as local_start,
        (sb.end_at at time zone v_business.timezone) as local_end
      from public.schedule_blocks sb
      where sb.business_id = v_actor.business_id
        and sb.court_id = p_court_id
        and sb.status = 'active'
        and sb.end_at > now()
    )
    select 1
    from active_blocks sb
    join proposed p on p.weekday = extract(isodow from sb.local_start)::smallint
    where sb.local_start::date >= p_effective_from
      and (p.effective_until is null or sb.local_start::date <= p.effective_until)
      and (
        sb.local_start::date <> sb.local_end::date
        or not p.is_open
        or sb.local_start::time < p.opens_at
        or sb.local_end::time > p.closes_at
        or mod((extract(epoch from (sb.local_end::time - sb.local_start::time)) / 60.0)::numeric, v_business.booking_increment_minutes::numeric) <> 0
        or mod((extract(epoch from (sb.local_start::time - p.opens_at)) / 60.0)::numeric, v_business.booking_increment_minutes::numeric) <> 0
      )
    limit 1
  ) then
    raise exception 'operating_hours_conflict_future_blocks' using errcode = '22023';
  end if;

  -- Si ya hay una versión exactamente en esa fecha, se edita esa versión futura
  -- sin alterar su rango. Esto permite corregir una programación sin tocar historia.
  update public.operating_hours oh
  set is_open = x.is_open,
      opens_at = case when x.is_open then x.opens_at::time else null end,
      closes_at = case when x.is_open then x.closes_at::time else null end,
      configuration_status = 'confirmed',
      updated_at = now()
  from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text)
  where oh.court_id = p_court_id
    and oh.weekday = x.weekday
    and oh.effective_from = p_effective_from;

  -- Para días sin versión exacta, se cierra solamente la vigencia anterior que
  -- alcanzaba la nueva fecha; las versiones posteriores permanecen intactas.
  update public.operating_hours oh
  set effective_until = p_effective_from - 1,
      updated_at = now()
  where oh.court_id = p_court_id
    and oh.effective_from < p_effective_from
    and (oh.effective_until is null or oh.effective_until >= p_effective_from)
    and not exists (
      select 1
      from public.operating_hours exact_row
      where exact_row.court_id = p_court_id
        and exact_row.weekday = oh.weekday
        and exact_row.effective_from = p_effective_from
    );

  insert into public.operating_hours (
    court_id, weekday, is_open, opens_at, closes_at,
    effective_from, effective_until, configuration_status
  )
  select
    p_court_id,
    x.weekday,
    x.is_open,
    case when x.is_open then x.opens_at::time else null end,
    case when x.is_open then x.closes_at::time else null end,
    p_effective_from,
    case when next_row.effective_from is not null then next_row.effective_from - 1 else null end,
    'confirmed'::public.configuration_status
  from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text)
  left join lateral (
    select oh.effective_from
    from public.operating_hours oh
    where oh.court_id = p_court_id
      and oh.weekday = x.weekday
      and oh.effective_from > p_effective_from
    order by oh.effective_from
    limit 1
  ) next_row on true
  where not exists (
    select 1
    from public.operating_hours exact_row
    where exact_row.court_id = p_court_id
      and exact_row.weekday = x.weekday
      and exact_row.effective_from = p_effective_from
  );

  -- Una sola señal sanitizada actualiza calendarios públicos ya abiertos.
  insert into public.availability_revisions (business_id, revision, updated_at)
  values (v_actor.business_id, 1, now())
  on conflict (business_id) do update
    set revision = public.availability_revisions.revision + 1,
        updated_at = now();

  return true;
exception
  when exclusion_violation then
    raise exception 'operating_hours_range_conflict' using errcode = '23P01';
end;
$$;

revoke all on function public.admin_schedule_court_operating_hours(uuid,jsonb,date)
  from public, anon, authenticated;
grant execute on function public.admin_schedule_court_operating_hours(uuid,jsonb,date)
  to authenticated;

comment on function public.admin_schedule_court_operating_hours(uuid,jsonb,date) is
  'B22: programa/reemplaza una semana regular futura por cancha, preserva historia/versiones posteriores y rechaza conflictos con reservas o bloqueos activos.';
