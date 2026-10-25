-- Bloque 20 · alta y gestión segura de inventario multi-tenant.
-- Mantiene el DML directo cerrado: toda mutación pasa por RPC SECURITY DEFINER.
-- El ADMIN global no hereda can_manage_business ni acceso a PII tenant.

create or replace function public.platform_admin_create_business(
  p_slug text,
  p_name text,
  p_owner_email text,
  p_city text default null,
  p_country text default null,
  p_address text default null,
  p_phone text default null,
  p_currency text default 'PEN',
  p_timezone text default 'America/Lima'
)
returns table (
  business_id uuid,
  business_slug text,
  business_name text,
  owner_user_id uuid
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_email text := lower(trim(coalesce(p_owner_email, '')));
  v_currency text := upper(trim(coalesce(p_currency, 'PEN')));
  v_timezone text := trim(coalesce(p_timezone, 'America/Lima'));
  v_owner_user_id uuid;
  v_owner_role public.platform_role;
  v_business public.businesses%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
    raise exception 'invalid_business_slug' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_business_name' using errcode = '22023';
  end if;
  if v_email = '' or char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid_owner_email' using errcode = '22023';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_phone, '')), '') is not null
     and trim(p_phone) !~ '^[+][1-9][0-9]{7,14}$' then
    raise exception 'invalid_business_phone' using errcode = '22023';
  end if;

  select u.id into v_owner_user_id
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_owner_user_id is null then
    raise exception 'owner_account_not_found' using errcode = 'P0002';
  end if;

  insert into public.user_accounts (user_id, role, is_active)
  values (v_owner_user_id, 'customer', true)
  on conflict (user_id) do nothing;

  select ua.role into v_owner_role
  from public.user_accounts ua
  where ua.user_id = v_owner_user_id
  for update;

  if v_owner_role = 'admin' then
    raise exception 'platform_admin_cannot_be_tenant_owner' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where p.user_id = v_owner_user_id) then
    raise exception 'owner_already_assigned' using errcode = '23505';
  end if;
  if exists (select 1 from public.businesses b where b.owner_user_id = v_owner_user_id) then
    raise exception 'owner_already_assigned' using errcode = '23505';
  end if;

  insert into public.businesses (
    slug, name, city, country, address, phone, currency, timezone,
    configuration_status, is_active, owner_user_id
  ) values (
    v_slug,
    v_name,
    nullif(regexp_replace(trim(coalesce(p_city, '')), '\s+', ' ', 'g'), ''),
    nullif(regexp_replace(trim(coalesce(p_country, '')), '\s+', ' ', 'g'), ''),
    nullif(regexp_replace(trim(coalesce(p_address, '')), '\s+', ' ', 'g'), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    v_currency,
    v_timezone,
    'provisional',
    true,
    v_owner_user_id
  ) returning * into v_business;

  update public.user_accounts
  set role = 'owner', is_active = true, updated_at = now()
  where user_id = v_owner_user_id;

  insert into public.profiles (user_id, business_id, role, display_name, is_active)
  values (v_owner_user_id, v_business.id, 'owner', null, true);

  return query select v_business.id, v_business.slug, v_business.name, v_owner_user_id;
end;
$$;

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
                )
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

create or replace function public.admin_update_business_profile(
  p_name text,
  p_city text,
  p_country text,
  p_address text,
  p_phone text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_business_name' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_phone, '')), '') is not null
     and trim(p_phone) !~ '^[+][1-9][0-9]{7,14}$' then
    raise exception 'invalid_business_phone' using errcode = '22023';
  end if;

  update public.businesses
  set name = v_name,
      city = nullif(regexp_replace(trim(coalesce(p_city, '')), '\s+', ' ', 'g'), ''),
      country = nullif(regexp_replace(trim(coalesce(p_country, '')), '\s+', ' ', 'g'), ''),
      address = nullif(regexp_replace(trim(coalesce(p_address, '')), '\s+', ' ', 'g'), ''),
      phone = nullif(trim(coalesce(p_phone, '')), ''),
      updated_at = now()
  where id = v_actor.business_id;
  return true;
end;
$$;

create or replace function public.admin_create_venue(
  p_slug text,
  p_name text,
  p_city text default null,
  p_address text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_venue_id uuid;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
    raise exception 'invalid_venue_slug' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_venue_name' using errcode = '22023';
  end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    raise exception 'invalid_latitude' using errcode = '22023';
  end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    raise exception 'invalid_longitude' using errcode = '22023';
  end if;

  insert into public.venues (business_id, slug, name, city, address, latitude, longitude, is_active)
  values (
    v_actor.business_id, v_slug, v_name,
    nullif(regexp_replace(trim(coalesce(p_city, '')), '\s+', ' ', 'g'), ''),
    nullif(regexp_replace(trim(coalesce(p_address, '')), '\s+', ' ', 'g'), ''),
    p_latitude, p_longitude, true
  ) returning id into v_venue_id;
  return v_venue_id;
end;
$$;

create or replace function public.admin_update_venue(
  p_venue_id uuid,
  p_name text,
  p_city text,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
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
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if p_venue_id is null or p_active is null or char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'invalid_venue_input' using errcode = '22023';
  end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    raise exception 'invalid_latitude' using errcode = '22023';
  end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    raise exception 'invalid_longitude' using errcode = '22023';
  end if;

  perform 1
  from public.venues v
  where v.id = p_venue_id and v.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'venue_not_found' using errcode = 'P0002';
  end if;

  if not p_active and exists (
    select 1 from public.courts c
    where c.business_id = v_actor.business_id and c.venue_id = p_venue_id and c.is_active
  ) then
    raise exception 'venue_has_active_courts' using errcode = '22023';
  end if;

  update public.venues
  set name = regexp_replace(trim(p_name), '\s+', ' ', 'g'),
      city = nullif(regexp_replace(trim(coalesce(p_city, '')), '\s+', ' ', 'g'), ''),
      address = nullif(regexp_replace(trim(coalesce(p_address, '')), '\s+', ' ', 'g'), ''),
      latitude = p_latitude,
      longitude = p_longitude,
      is_active = p_active,
      updated_at = now()
  where id = p_venue_id and business_id = v_actor.business_id;
  return true;
end;
$$;

create or replace function public.admin_create_court(
  p_venue_id uuid,
  p_sport_id uuid,
  p_slug text,
  p_name text,
  p_surface text,
  p_hours jsonb,
  p_rate_without_lights numeric,
  p_rate_with_lights numeric
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_court_id uuid;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_today date;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
    raise exception 'invalid_court_slug' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_court_name' using errcode = '22023';
  end if;
  if p_rate_without_lights is null or p_rate_without_lights <= 0 or p_rate_without_lights > 10000
     or p_rate_with_lights is null or p_rate_with_lights <= 0 or p_rate_with_lights > 10000 then
    raise exception 'invalid_hourly_rate' using errcode = '22023';
  end if;
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) <> 7 then
    raise exception 'invalid_weekly_hours' using errcode = '22023';
  end if;
  if not exists (
    select 1 from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text)
    where x.is_open
  ) then
    raise exception 'at_least_one_open_day_required' using errcode = '22023';
  end if;
  if (select count(distinct x.weekday) from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text)) <> 7
     or exists (
       select 1
       from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text)
       where x.weekday not between 1 and 7
          or x.is_open is null
          or (x.is_open and (x.opens_at is null or x.closes_at is null or x.opens_at::time >= x.closes_at::time))
     ) then
    raise exception 'invalid_weekly_hours' using errcode = '22023';
  end if;
  perform 1
  from public.venues v
  where v.id = p_venue_id and v.business_id = v_actor.business_id and v.is_active
  for share;
  if not found then
    raise exception 'venue_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.sports s where s.id = p_sport_id and s.is_active) then
    raise exception 'sport_not_found' using errcode = 'P0002';
  end if;

  v_today := (now() at time zone v_actor.timezone)::date;

  insert into public.courts (
    business_id, venue_id, sport_id, slug, name, surface, configuration_status, is_active
  ) values (
    v_actor.business_id, p_venue_id, p_sport_id, v_slug, v_name,
    nullif(regexp_replace(trim(coalesce(p_surface, '')), '\s+', ' ', 'g'), ''),
    'confirmed', false
  ) returning id into v_court_id;

  insert into public.operating_hours (
    court_id, weekday, is_open, opens_at, closes_at, effective_from, configuration_status
  )
  select
    v_court_id,
    x.weekday,
    x.is_open,
    case when x.is_open then x.opens_at::time else null end,
    case when x.is_open then x.closes_at::time else null end,
    v_today,
    'confirmed'::public.configuration_status
  from jsonb_to_recordset(p_hours) as x(weekday smallint, is_open boolean, opens_at text, closes_at text);

  insert into public.pricing_rules (
    court_id, lighting, label, hourly_rate, effective_from, is_active, configuration_status, created_by
  ) values
    (v_court_id, 'without_lights', 'Sin luz', p_rate_without_lights, v_today, true, 'confirmed', v_actor.user_id),
    (v_court_id, 'with_lights', 'Con luz', p_rate_with_lights, v_today, true, 'confirmed', v_actor.user_id);

  update public.courts set is_active = true, updated_at = now() where id = v_court_id;
  return v_court_id;
end;
$$;

create or replace function public.admin_update_court_identity(
  p_court_id uuid,
  p_name text,
  p_surface text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if p_court_id is null or char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'invalid_court_input' using errcode = '22023';
  end if;
  update public.courts
  set name = regexp_replace(trim(p_name), '\s+', ' ', 'g'),
      surface = nullif(regexp_replace(trim(coalesce(p_surface, '')), '\s+', ' ', 'g'), ''),
      updated_at = now()
  where id = p_court_id and business_id = v_actor.business_id;
  if not found then raise exception 'court_not_found' using errcode = 'P0002'; end if;
  return true;
end;
$$;

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
  v_court public.courts%rowtype;
  v_today date;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if p_court_id is null or p_active is null then
    raise exception 'invalid_court_state' using errcode = '22023';
  end if;
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
    v_today := (now() at time zone v_actor.timezone)::date;
    perform 1
    from public.venues v
    where v.id = v_court.venue_id and v.business_id = v_actor.business_id and v.is_active
    for share;
    if not found then
      raise exception 'court_dependencies_inactive' using errcode = '22023';
    end if;
    if not exists (select 1 from public.sports s where s.id = v_court.sport_id and s.is_active) then
      raise exception 'court_dependencies_inactive' using errcode = '22023';
    end if;
    if (select count(distinct oh.weekday) from public.operating_hours oh
        where oh.court_id = v_court.id and v_today >= oh.effective_from and (oh.effective_until is null or v_today <= oh.effective_until)) <> 7 then
      raise exception 'court_hours_not_ready' using errcode = '22023';
    end if;
    if (select count(distinct pr.lighting) from public.pricing_rules pr
        where pr.court_id = v_court.id and pr.is_active and v_today >= pr.effective_from and (pr.effective_until is null or v_today <= pr.effective_until)) <> 2 then
      raise exception 'court_pricing_not_ready' using errcode = '22023';
    end if;
  end if;

  update public.courts set is_active = p_active, updated_at = now() where id = v_court.id;
  return true;
end;
$$;

-- B20 hardening: tenant authorization always requires an active business and
-- an active tenant profile. owner_user_id remains ownership metadata, not a
-- bypass around profile revocation or business suspension.
create or replace function public.can_view_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.businesses b
    join public.profiles p on p.business_id = b.id
    where b.id = target_business_id
      and b.is_active
      and p.user_id = (select auth.uid())
      and p.is_active
      and p.role in ('owner', 'admin', 'staff')
  );
$$;

create or replace function public.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.businesses b
    join public.profiles p on p.business_id = b.id
    where b.id = target_business_id
      and b.is_active
      and p.user_id = (select auth.uid())
      and p.is_active
      and p.role in ('owner', 'admin')
  );
$$;

-- El owner_user_id es el propietario principal. B20 no implementa transferencia
-- de propiedad; por eso no puede degradarse/desactivarse desde el panel tenant.
create or replace function public.admin_access_update_profile(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_role public.app_role default null,
  p_display_name text default null,
  p_display_name_provided boolean default false,
  p_is_active boolean default null
)
returns table (
  user_id uuid,
  business_id uuid,
  role public.app_role,
  display_name text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_next_role public.app_role;
  v_next_display_name text;
  v_next_is_active boolean;
  v_active_owner_count integer;
  v_primary_owner_user_id uuid;
begin
  if p_actor_user_id is null or p_target_user_id is null then
    raise exception 'invalid_admin_access_input' using errcode = '22023';
  end if;

  select p.* into v_actor
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where p.user_id = p_actor_user_id
    and p.is_active
    and p.role = 'owner'
    and b.is_active
  for share of p;

  if not found then
    raise exception 'admin_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles p
  where p.business_id = v_actor.business_id
  for update;

  select p.* into v_target
  from public.profiles p
  where p.user_id = p_target_user_id
    and p.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'user_not_in_business' using errcode = 'P0002';
  end if;

  v_next_role := coalesce(p_role, v_target.role);
  v_next_is_active := coalesce(p_is_active, v_target.is_active);
  v_next_display_name := case
    when p_display_name_provided then nullif(btrim(p_display_name), '')
    else v_target.display_name
  end;

  if p_target_user_id = p_actor_user_id
     and (v_next_role <> 'owner' or not v_next_is_active) then
    raise exception 'cannot_change_own_access' using errcode = '23514';
  end if;

  select b.owner_user_id into v_primary_owner_user_id
  from public.businesses b
  where b.id = v_actor.business_id
  for update;

  if p_target_user_id = v_primary_owner_user_id
     and (v_next_role <> 'owner' or not v_next_is_active) then
    raise exception 'primary_owner_transfer_required' using errcode = '23514';
  end if;

  if v_next_display_name is not null and char_length(v_next_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  update public.profiles p
  set role = v_next_role,
      display_name = v_next_display_name,
      is_active = v_next_is_active,
      updated_at = now()
  where p.user_id = p_target_user_id
    and p.business_id = v_actor.business_id;

  select count(*)::integer into v_active_owner_count
  from public.profiles p
  where p.business_id = v_actor.business_id
    and p.is_active
    and p.role = 'owner';

  if v_active_owner_count < 1 then
    raise exception 'active_owner_required' using errcode = '23514';
  end if;

  return query
  select p.user_id, p.business_id, p.role, p.display_name, p.is_active, p.created_at, p.updated_at
  from public.profiles p
  where p.user_id = p_target_user_id
    and p.business_id = v_actor.business_id;
end;
$$;

-- La suspensión global no puede dejar reservas futuras vivas sin panel tenant.
create or replace function public.platform_admin_set_business_active(
  p_business_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;
  if p_business_id is null or p_active is null then
    raise exception 'invalid_business_state' using errcode = '22023';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = p_business_id
  for update;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  if not p_active and exists (
    select 1
    from public.reservations r
    where r.business_id = p_business_id
      and r.status in ('pending', 'confirmed')
      and r.end_at > now()
  ) then
    raise exception 'business_has_future_reservations' using errcode = '22023';
  end if;

  update public.businesses
  set is_active = p_active,
      updated_at = now()
  where id = p_business_id;

  return true;
end;
$$;

revoke all on function public.platform_admin_create_business(text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.get_admin_business_structure() from public, anon, authenticated;
revoke all on function public.admin_update_business_profile(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.admin_create_venue(text,text,text,text,numeric,numeric) from public, anon, authenticated;
revoke all on function public.admin_update_venue(uuid,text,text,text,numeric,numeric,boolean) from public, anon, authenticated;
revoke all on function public.admin_create_court(uuid,uuid,text,text,text,jsonb,numeric,numeric) from public, anon, authenticated;
revoke all on function public.admin_update_court_identity(uuid,text,text) from public, anon, authenticated;
revoke all on function public.admin_set_court_active(uuid,boolean) from public, anon, authenticated;
revoke all on function public.can_view_business(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_business(uuid) from public, anon, authenticated;
revoke all on function public.admin_access_update_profile(uuid,uuid,public.app_role,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.platform_admin_set_business_active(uuid,boolean) from public, anon, authenticated;

grant execute on function public.platform_admin_create_business(text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.get_admin_business_structure() to authenticated;
grant execute on function public.admin_update_business_profile(text,text,text,text,text) to authenticated;
grant execute on function public.admin_create_venue(text,text,text,text,numeric,numeric) to authenticated;
grant execute on function public.admin_update_venue(uuid,text,text,text,numeric,numeric,boolean) to authenticated;
grant execute on function public.admin_create_court(uuid,uuid,text,text,text,jsonb,numeric,numeric) to authenticated;
grant execute on function public.admin_update_court_identity(uuid,text,text) to authenticated;
grant execute on function public.admin_set_court_active(uuid,boolean) to authenticated;
grant execute on function public.can_view_business(uuid) to authenticated;
grant execute on function public.can_manage_business(uuid) to authenticated;
grant execute on function public.admin_access_update_profile(uuid,uuid,public.app_role,text,boolean,boolean) to service_role;
grant execute on function public.platform_admin_set_business_active(uuid,boolean) to authenticated;

-- El catálogo público transporta el timezone del negocio para que /reservar
-- calcule "hoy" y la semana inicial con la misma zona que disponibilidad/pricing.
drop function if exists public.get_public_platform_catalog(text, text);

create function public.get_public_platform_catalog(
  p_sport_slug text default null,
  p_city text default null
)
returns table (
  business_id uuid,
  business_slug text,
  business_name text,
  business_city text,
  business_country text,
  business_timezone text,
  cover_image_url text,
  cover_alt_text text,
  rating_average numeric,
  review_count bigint,
  venue_id uuid,
  venue_slug text,
  venue_name text,
  venue_city text,
  venue_address text,
  latitude numeric,
  longitude numeric,
  court_id uuid,
  court_slug text,
  court_name text,
  court_surface text,
  sport_id uuid,
  sport_slug text,
  sport_name text,
  price_from numeric,
  currency text
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
    cover.image_url, cover.alt_text,
    rep.rating_average, coalesce(rep.review_count, 0)::bigint,
    v.id, v.slug, v.name, v.city, v.address, v.latitude, v.longitude,
    c.id, c.slug, c.name, c.surface,
    s.id, s.slug, s.name,
    rates.price_from, b.currency
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
    order by
      case when coalesce(item->>'sortOrder', '') ~ '^[0-9]{1,4}$' then (item->>'sortOrder')::integer else 0 end,
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
    and (p_sport_slug is null or s.slug = p_sport_slug)
    and (p_city is null or lower(coalesce(v.city, b.city, '')) = lower(p_city))
  order by b.name, v.sort_order, v.name, c.sort_order, c.name;
$$;

revoke all on function public.get_public_platform_catalog(text,text) from public;
grant execute on function public.get_public_platform_catalog(text,text) to anon, authenticated;

comment on function public.platform_admin_create_business(text,text,text,text,text,text,text,text,text) is
  'B20: alta atómica de tenant + OWNER existente. ADMIN global explícito; no concede acceso cross-tenant por RLS.';
comment on function public.get_admin_business_structure() is
  'B20: estructura negocio/sedes/canchas sin PII de clientes, derivada del perfil administrativo actual.';
