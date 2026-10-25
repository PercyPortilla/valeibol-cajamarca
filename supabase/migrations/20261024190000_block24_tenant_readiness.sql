-- Bloque 24 · readiness y ciclo de publicación del tenant.
-- Separa suspensión global (is_active) de publicación operativa (configuration_status).

create or replace function private.business_publication_readiness(p_business_id uuid)
returns table (
  has_active_venue boolean,
  has_active_court boolean,
  active_courts_ready boolean,
  active_court_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with business_context as (
    select b.id, b.timezone, (now() at time zone b.timezone)::date as business_today
    from public.businesses b
    where b.id = p_business_id
  ), active_courts as (
    select c.*, bc.business_today
    from business_context bc
    join public.courts c on c.business_id = bc.id and c.is_active
  )
  select
    exists (
      select 1 from public.venues v
      where v.business_id = p_business_id and v.is_active
    ),
    exists (select 1 from active_courts),
    not exists (
      select 1
      from active_courts c
      where not exists (
           select 1 from public.venues v
           where v.id = c.venue_id and v.business_id = p_business_id and v.is_active
         )
         or not exists (
           select 1 from public.sports s
           where s.id = c.sport_id and s.is_active
         )
         or (
           select count(distinct oh.weekday)
           from public.operating_hours oh
           where oh.court_id = c.id
             and c.business_today >= oh.effective_from
             and (oh.effective_until is null or c.business_today <= oh.effective_until)
             and oh.configuration_status = 'confirmed'
         ) <> 7
         or not exists (
           select 1
           from public.operating_hours oh
           where oh.court_id = c.id
             and c.business_today >= oh.effective_from
             and (oh.effective_until is null or c.business_today <= oh.effective_until)
             and oh.configuration_status = 'confirmed'
             and oh.is_open
         )
         or (
           select count(distinct pr.lighting)
           from public.pricing_rules pr
           where pr.court_id = c.id
             and pr.is_active
             and pr.configuration_status = 'confirmed'
             and c.business_today >= pr.effective_from
             and (pr.effective_until is null or c.business_today <= pr.effective_until)
         ) <> 2
    ),
    (select count(*) from active_courts);
$$;

revoke all on function private.business_publication_readiness(uuid) from public, anon, authenticated;

create or replace function public.get_admin_publication_readiness()
returns table (
  configuration_status public.configuration_status,
  has_active_venue boolean,
  has_active_court boolean,
  active_courts_ready boolean,
  active_court_count bigint
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
  select b.configuration_status, r.has_active_venue, r.has_active_court, r.active_courts_ready, r.active_court_count
  from public.businesses b
  cross join lateral private.business_publication_readiness(b.id) r
  where b.id = v_actor.business_id and b.is_active;
end;
$$;

create or replace function public.admin_set_business_configuration_status(
  p_status public.configuration_status
)
returns public.configuration_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_business public.businesses%rowtype;
  v_ready record;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if p_status is null then
    raise exception 'invalid_configuration_status' using errcode = '22023';
  end if;

  -- Frontera compartida con B22/B23 y booking público: business primero.
  select b.* into v_business
  from public.businesses b
  where b.id = v_actor.business_id and b.is_active
  for update;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  if v_business.configuration_status = p_status then
    return p_status;
  end if;

  if p_status = 'confirmed' then
    select * into v_ready from private.business_publication_readiness(v_business.id);
    if not coalesce(v_ready.has_active_venue, false) then
      raise exception 'publication_requires_active_venue' using errcode = '22023';
    end if;
    if not coalesce(v_ready.has_active_court, false) then
      raise exception 'publication_requires_active_court' using errcode = '22023';
    end if;
    if not coalesce(v_ready.active_courts_ready, false) then
      raise exception 'publication_requires_ready_courts' using errcode = '22023';
    end if;
  end if;

  update public.businesses
  set configuration_status = p_status, updated_at = now()
  where id = v_business.id;

  insert into public.availability_revisions (business_id, revision, updated_at)
  values (v_business.id, 1, now())
  on conflict (business_id) do update
    set revision = public.availability_revisions.revision + 1,
        updated_at = now();

  return p_status;
end;
$$;

revoke all on function public.get_admin_publication_readiness() from public, anon, authenticated;
revoke all on function public.admin_set_business_configuration_status(public.configuration_status) from public, anon, authenticated;
grant execute on function public.get_admin_publication_readiness() to authenticated;
grant execute on function public.admin_set_business_configuration_status(public.configuration_status) to authenticated;

-- Alinea las señales por cancha con el mismo readiness que usa publicación.
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
    b.id, b.slug, b.name, b.city, b.country, b.address, b.phone, b.currency, b.timezone,
    b.configuration_status,
    coalesce((
      select jsonb_agg(jsonb_build_object('sportId', s.id, 'slug', s.slug, 'name', s.name) order by s.sort_order, s.name)
      from public.sports s where s.is_active
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
                    and bool_or(oh.is_open)
                  from public.operating_hours oh
                  where oh.court_id = c.id
                    and oh.configuration_status = 'confirmed'
                    and (now() at time zone b.timezone)::date >= oh.effective_from
                    and (oh.effective_until is null or (now() at time zone b.timezone)::date <= oh.effective_until)
                ),
                'pricingConfigured', (
                  select count(distinct pr.lighting) = 2
                  from public.pricing_rules pr
                  where pr.court_id = c.id
                    and pr.is_active
                    and pr.configuration_status = 'confirmed'
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

revoke all on function public.get_admin_business_structure() from public, anon, authenticated;
grant execute on function public.get_admin_business_structure() to authenticated;

-- Mantiene visibles los tenants que ya estaban operativos antes de introducir
-- el lifecycle explícito. Solo confirma negocios que satisfacen el mismo
-- readiness DB-authoritativo usado por la acción administrativa.
update public.operating_hours oh
set configuration_status = 'confirmed',
    updated_at = now()
from public.courts c, public.businesses b
where oh.court_id = c.id
  and c.business_id = b.id
  and b.is_active
  and b.configuration_status = 'provisional'
  and c.is_active
  and (now() at time zone b.timezone)::date >= oh.effective_from
  and (oh.effective_until is null or (now() at time zone b.timezone)::date <= oh.effective_until)
  and oh.configuration_status = 'provisional';

do $$
declare
  v_business_id uuid;
  v_ready record;
begin
  for v_business_id in
    select b.id from public.businesses b
    where b.is_active and b.configuration_status = 'provisional'
  loop
    select * into v_ready from private.business_publication_readiness(v_business_id);
    if coalesce(v_ready.has_active_venue, false)
       and coalesce(v_ready.has_active_court, false)
       and coalesce(v_ready.active_courts_ready, false) then
      update public.businesses
      set configuration_status = 'confirmed', updated_at = now()
      where id = v_business_id;

      insert into public.availability_revisions (business_id, revision, updated_at)
      values (v_business_id, 1, now())
      on conflict (business_id) do update
        set revision = public.availability_revisions.revision + 1,
            updated_at = now();
    end if;
  end loop;
end;
$$;

-- Mantiene la oferta de un tenant publicado. B24 comparte el orden de locks
-- business -> court usado por booking/B22 y evita desactivar la última cancha lista.
create or replace function public.admin_set_court_active(
  p_court_id uuid,
  p_active boolean
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
  v_ready record;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if p_court_id is null or p_active is null then
    raise exception 'invalid_court_state' using errcode = '22023';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_actor.business_id and b.is_active
  for update;
  if not found then raise exception 'business_not_found' using errcode = 'P0002'; end if;

  select c.* into v_court
  from public.courts c
  where c.id = p_court_id and c.business_id = v_actor.business_id
  for update;
  if not found then raise exception 'court_not_found' using errcode = 'P0002'; end if;

  if not p_active and exists (
    select 1 from public.reservations r
    where r.court_id = v_court.id
      and r.business_id = v_actor.business_id
      and r.status in ('pending', 'confirmed')
      and r.end_at > now()
  ) then
    raise exception 'court_has_future_reservations' using errcode = '22023';
  end if;

  if p_active then
    v_today := (now() at time zone v_business.timezone)::date;
    perform 1
    from public.venues v
    where v.id = v_court.venue_id and v.business_id = v_actor.business_id and v.is_active
    for share;
    if not found then raise exception 'court_dependencies_inactive' using errcode = '22023'; end if;
    if not exists (select 1 from public.sports s where s.id = v_court.sport_id and s.is_active) then
      raise exception 'court_dependencies_inactive' using errcode = '22023';
    end if;
    if (select count(distinct oh.weekday) from public.operating_hours oh
        where oh.court_id = v_court.id
          and oh.configuration_status = 'confirmed'
          and v_today >= oh.effective_from
          and (oh.effective_until is null or v_today <= oh.effective_until)) <> 7
       or not exists (
         select 1 from public.operating_hours oh
         where oh.court_id = v_court.id
           and oh.configuration_status = 'confirmed'
           and oh.is_open
           and v_today >= oh.effective_from
           and (oh.effective_until is null or v_today <= oh.effective_until)
       ) then
      raise exception 'court_hours_not_ready' using errcode = '22023';
    end if;
    if (select count(distinct pr.lighting) from public.pricing_rules pr
        where pr.court_id = v_court.id
          and pr.is_active
          and pr.configuration_status = 'confirmed'
          and v_today >= pr.effective_from
          and (pr.effective_until is null or v_today <= pr.effective_until)) <> 2 then
      raise exception 'court_pricing_not_ready' using errcode = '22023';
    end if;
  end if;

  update public.courts set is_active = p_active, updated_at = now() where id = v_court.id;

  if not p_active and v_business.configuration_status = 'confirmed' then
    select * into v_ready from private.business_publication_readiness(v_business.id);
    if not coalesce(v_ready.has_active_court, false) or not coalesce(v_ready.active_courts_ready, false) then
      raise exception 'published_business_requires_ready_court' using errcode = '22023';
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.admin_set_court_active(uuid,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_court_active(uuid,boolean) to authenticated;

-- Gating público: provisional sigue administrable, pero no es descubrible ni reservable.
create or replace function public.get_public_availability(
  p_business_slug text,
  p_from date,
  p_to date
)
returns table (
  business_id uuid,
  business_name text,
  business_timezone text,
  court_id uuid,
  court_name text,
  calendar_date date,
  is_open boolean,
  opens_at time,
  closes_at time,
  schedule_status public.configuration_status,
  busy_intervals jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if (p_to - p_from) > 31 then
    raise exception 'date range too large; maximum is 32 calendar days' using errcode = '22023';
  end if;

  return query
  select
    b.id, b.name, b.timezone, c.id, c.name, d.day::date,
    coalesce(oh.is_open, false), oh.opens_at, oh.closes_at,
    coalesce(oh.configuration_status, 'provisional'::public.configuration_status),
    coalesce(
      jsonb_agg(jsonb_build_object('startAt', e.start_at, 'endAt', e.end_at, 'kind', e.source_kind) order by e.start_at)
        filter (where e.id is not null),
      '[]'::jsonb
    )
  from public.businesses b
  join public.courts c on c.business_id = b.id and c.is_active
  cross join lateral generate_series(p_from, p_to, interval '1 day') as d(day)
  left join lateral (
    select oh2.*
    from public.operating_hours oh2
    where oh2.court_id = c.id
      and oh2.weekday = extract(isodow from d.day)::smallint
      and d.day::date >= oh2.effective_from
      and (oh2.effective_until is null or d.day::date <= oh2.effective_until)
    order by oh2.effective_from desc
    limit 1
  ) oh on true
  left join public.court_schedule_entries e
    on e.court_id = c.id
   and e.blocks_availability
   and e.start_at < ((d.day::date + 1)::timestamp at time zone b.timezone)
   and e.end_at > (d.day::date::timestamp at time zone b.timezone)
  where b.slug = p_business_slug
    and b.is_active
    and b.configuration_status = 'confirmed'
  group by b.id, b.name, b.timezone, c.id, c.name, d.day, oh.is_open, oh.opens_at, oh.closes_at, oh.configuration_status
  order by c.sort_order, c.name, d.day;
end;
$$;

create or replace function public.get_public_pricing_for_date(
  p_business_slug text,
  p_date date
)
returns table (
  business_id uuid, business_name text, currency text, timezone text,
  court_id uuid, court_name text, lighting public.lighting_mode, label text,
  hourly_rate numeric, effective_from date, effective_until date,
  configuration_status public.configuration_status
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.id, b.name, b.currency, b.timezone, c.id, c.name,
         pr.lighting, pr.label, pr.hourly_rate, pr.effective_from,
         pr.effective_until, pr.configuration_status
  from public.businesses b
  join public.courts c on c.business_id = b.id and c.is_active
  join public.pricing_rules pr
    on pr.court_id = c.id
   and pr.is_active
   and p_date >= pr.effective_from
   and (pr.effective_until is null or p_date <= pr.effective_until)
  where b.slug = p_business_slug
    and b.is_active
    and b.configuration_status = 'confirmed'
    and p_date is not null
  order by c.sort_order, c.name, pr.lighting;
$$;

create or replace function public.get_public_business_config(p_business_slug text)
returns table (
  business_id uuid, business_name text, short_name text, category text,
  city text, country text, address text, phone text, currency text, timezone text,
  configuration_status public.configuration_status, pricing jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id, b.name, b.short_name, b.category, b.city, b.country, b.address, b.phone,
    b.currency, b.timezone, b.configuration_status,
    coalesce(
      jsonb_agg(jsonb_build_object(
        'courtId', c.id, 'courtName', c.name, 'lighting', pr.lighting,
        'label', pr.label, 'hourlyRate', pr.hourly_rate, 'status', pr.configuration_status
      ) order by c.sort_order, pr.lighting) filter (where pr.id is not null),
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
    and b.configuration_status = 'confirmed'
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
    b.id, b.name, b.currency, b.timezone, b.booking_increment_minutes,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'courtId', c.id,
          'courtName', c.name,
          'pricing', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'lighting', pr.lighting, 'label', pr.label,
              'hourlyRate', pr.hourly_rate, 'status', pr.configuration_status
            ) order by pr.lighting), '[]'::jsonb)
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
  left join public.courts c on c.business_id = b.id and c.is_active
  where b.slug = p_business_slug
    and b.is_active
    and b.configuration_status = 'confirmed'
  group by b.id;
$$;

create or replace function public.get_public_site_content(p_business_slug text)
returns table (
  business_id uuid,
  services jsonb,
  gallery jsonb,
  theme jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    coalesce((
      select jsonb_agg(item order by coalesce((item->>'sortOrder')::integer, 0))
      from jsonb_array_elements(coalesce(c.services, '[]'::jsonb)) item
      where coalesce((item->>'isVisible')::boolean, true)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(item order by coalesce((item->>'sortOrder')::integer, 0))
      from jsonb_array_elements(coalesce(c.gallery, '[]'::jsonb)) item
      where coalesce((item->>'isVisible')::boolean, true)
    ), '[]'::jsonb),
    coalesce(c.theme, '{"presetId":"classic","navy":"#0C2B4A","blue":"#155FA8","blueDark":"#0F4B88","red":"#B72F34","redDark":"#92252A","yellow":"#F4C430","canvas":"#F3F7FB"}'::jsonb),
    c.updated_at
  from public.businesses b
  left join public.business_site_content c on c.business_id = b.id
  where b.slug = p_business_slug
    and b.is_active
    and b.configuration_status = 'confirmed'
  limit 1;
$$;

create or replace function public.get_public_business_reviews(
  p_business_slug text,
  p_limit integer default 12
)
returns table (
  review_id uuid,
  rating smallint,
  created_at timestamptz,
  court_name text,
  sport_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select rv.id, rv.rating, rv.created_at, c.name, s.name
  from public.business_reviews rv
  join public.businesses b
    on b.id = rv.business_id
   and b.is_active
   and b.configuration_status = 'confirmed'
  join public.reservations r on r.id = rv.reservation_id and r.business_id = rv.business_id
  join public.courts c on c.id = r.court_id and c.business_id = rv.business_id
  join public.sports s on s.id = c.sport_id
  where b.slug = p_business_slug
    and rv.status = 'published'
  order by rv.created_at desc, rv.id desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

drop function if exists public.get_public_platform_catalog(text, text);
create function public.get_public_platform_catalog(
  p_sport_slug text default null,
  p_city text default null
)
returns table (
  business_id uuid, business_slug text, business_name text, business_city text,
  business_country text, business_timezone text, cover_image_url text,
  cover_alt_text text, rating_average numeric, review_count bigint,
  venue_id uuid, venue_slug text, venue_name text, venue_city text,
  venue_address text, latitude numeric, longitude numeric, court_id uuid,
  court_slug text, court_name text, court_surface text, sport_id uuid,
  sport_slug text, sport_name text, price_from numeric, currency text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with reputation as (
    select rv.business_id, round(avg(rv.rating)::numeric, 1) as rating_average, count(*)::bigint as review_count
    from public.business_reviews rv
    where rv.status = 'published'
    group by rv.business_id
  )
  select
    b.id, b.slug, b.name, b.city, b.country, b.timezone,
    cover.image_url, cover.alt_text, rep.rating_average, coalesce(rep.review_count, 0)::bigint,
    v.id, v.slug, v.name, v.city, v.address, v.latitude, v.longitude,
    c.id, c.slug, c.name, c.surface, s.id, s.slug, s.name, rates.price_from, b.currency
  from public.businesses b
  join public.venues v on v.business_id = b.id and v.is_active
  join public.courts c on c.business_id = b.id and c.venue_id = v.id and c.is_active
  join public.sports s on s.id = c.sport_id and s.is_active
  left join public.business_site_content site_content on site_content.business_id = b.id
  left join lateral (
    select nullif(btrim(item->>'imageUrl'), '') as image_url, nullif(btrim(item->>'altText'), '') as alt_text
    from jsonb_array_elements(coalesce(site_content.gallery, '[]'::jsonb)) item
    where lower(coalesce(item->>'isVisible', 'true')) not in ('false', 'f', 'no', 'n', '0', 'off')
      and nullif(btrim(item->>'imageUrl'), '') is not null
    order by case when coalesce(item->>'sortOrder', '') ~ '^[0-9]{1,4}$' then (item->>'sortOrder')::integer else 0 end,
             coalesce(item->>'id', '')
    limit 1
  ) cover on true
  left join reputation rep on rep.business_id = b.id
  left join lateral (
    select min(pr.hourly_rate) as price_from
    from public.pricing_rules pr
    where pr.court_id = c.id
      and pr.is_active
      and ((now() at time zone b.timezone)::date) >= pr.effective_from
      and (pr.effective_until is null or ((now() at time zone b.timezone)::date) <= pr.effective_until)
  ) rates on true
  where b.is_active
    and b.configuration_status = 'confirmed'
    and (p_sport_slug is null or s.slug = p_sport_slug)
    and (p_city is null or lower(coalesce(v.city, b.city, '')) = lower(p_city))
  order by b.name, v.sort_order, v.name, c.sort_order, c.name;
$$;

-- Defensa final: cualquier alta de reserva nueva exige tenant publicado.
-- No se aplica a UPDATE para que retirar publicación no impida operar reservas existentes.
create or replace function private.guard_new_reservation_business_published()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.source = 'public_web' and not exists (
    select 1
    from public.businesses b
    where b.id = new.business_id
      and b.is_active
      and b.configuration_status = 'confirmed'
  ) then
    raise exception 'business_not_published' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_require_published_business on public.reservations;
create trigger reservations_require_published_business
before insert on public.reservations
for each row execute function private.guard_new_reservation_business_published();

revoke all on function private.guard_new_reservation_business_published() from public, anon, authenticated;

revoke all on function public.get_public_availability(text,date,date) from public;
revoke all on function public.get_public_pricing_for_date(text,date) from public;
revoke all on function public.get_public_business_config(text) from public;
revoke all on function public.get_public_booking_context(text) from public;
revoke all on function public.get_public_platform_catalog(text,text) from public;
revoke all on function public.get_public_site_content(text) from public;
revoke all on function public.get_public_business_reviews(text,integer) from public;
grant execute on function public.get_public_availability(text,date,date) to anon, authenticated;
grant execute on function public.get_public_pricing_for_date(text,date) to anon, authenticated;
grant execute on function public.get_public_business_config(text) to anon, authenticated;
grant execute on function public.get_public_booking_context(text) to anon, authenticated;
grant execute on function public.get_public_platform_catalog(text,text) to anon, authenticated;
grant execute on function public.get_public_site_content(text) to anon, authenticated;
grant execute on function public.get_public_business_reviews(text,integer) to anon, authenticated;

comment on function public.admin_set_business_configuration_status(public.configuration_status) is
  'B24: owner/admin publica o retira el tenant sin alterar is_active; la publicación exige readiness operativo DB-authoritativo.';
