-- B61 · marca global SportCenter Caxas + logos de negocios en catálogo.

alter table public.business_site_content
  add column if not exists logo_url text;

alter table public.business_site_content
  drop constraint if exists business_site_content_logo_url_check;
alter table public.business_site_content
  add constraint business_site_content_logo_url_check
  check (
    logo_url is null
    or (
      char_length(logo_url) <= 1200
      and (
        logo_url ~* '^https?://'
        or logo_url ~ '^/images/[A-Za-z0-9._/-]+$'
      )
    )
  );

update public.business_site_content c
set logo_url = '/images/valeibol-logo.webp',
    updated_at = now()
from public.businesses b
where b.id = c.business_id
  and b.slug = 'valeibol-cajamarca'
  and nullif(btrim(c.logo_url), '') is null;

-- Repara mojibake histórico sin depender de la codificación del archivo SQL.
update public.sports
set name = case slug
  when 'voley' then 'V' || chr(243) || 'ley'
  when 'futbol' then 'F' || chr(250) || 'tbol'
  when 'basquet' then 'B' || chr(225) || 'squet'
  else name
end,
updated_at = now()
where slug in ('voley', 'futbol', 'basquet');

drop function if exists public.get_public_site_content(text);
create function public.get_public_site_content(p_business_slug text)
returns table (
  business_id uuid,
  logo_url text,
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
    c.logo_url,
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

drop function if exists public.get_admin_site_content();
create function public.get_admin_site_content()
returns table (
  business_id uuid,
  logo_url text,
  services jsonb,
  gallery jsonb,
  theme jsonb,
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
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  return query
  select
    v_actor.business_id,
    c.logo_url,
    coalesce(c.services, '[]'::jsonb),
    coalesce(c.gallery, '[]'::jsonb),
    coalesce(c.theme, '{"presetId":"classic","navy":"#0C2B4A","blue":"#155FA8","blueDark":"#0F4B88","red":"#B72F34","redDark":"#92252A","yellow":"#F4C430","canvas":"#F3F7FB"}'::jsonb),
    c.updated_at
  from (select 1) seed
  left join public.business_site_content c on c.business_id = v_actor.business_id;
end;
$$;

drop function if exists public.admin_update_site_content(jsonb, jsonb, jsonb);
drop function if exists public.admin_update_site_content(text, jsonb, jsonb, jsonb);
create function public.admin_update_site_content(
  p_logo_url text default null,
  p_services jsonb default '[]'::jsonb,
  p_gallery jsonb default '[]'::jsonb,
  p_theme jsonb default '{"presetId":"classic","navy":"#0C2B4A","blue":"#155FA8","blueDark":"#0F4B88","red":"#B72F34","redDark":"#92252A","yellow":"#F4C430","canvas":"#F3F7FB"}'::jsonb
)
returns table (
  business_id uuid,
  logo_url text,
  services jsonb,
  gallery jsonb,
  theme jsonb,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_updated public.business_site_content%rowtype;
  v_logo_url text := nullif(btrim(p_logo_url), '');
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if v_logo_url is not null and (
    char_length(v_logo_url) > 1200
    or (
      v_logo_url !~* '^https?://'
      and v_logo_url !~ '^/images/[A-Za-z0-9._/-]+$'
    )
  ) then
    raise exception 'invalid_logo_url' using errcode = '22023';
  end if;
  if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) > 24 then
    raise exception 'invalid_services' using errcode = '22023';
  end if;
  if p_gallery is null or jsonb_typeof(p_gallery) <> 'array' or jsonb_array_length(p_gallery) > 16 then
    raise exception 'invalid_gallery' using errcode = '22023';
  end if;
  if p_theme is null or jsonb_typeof(p_theme) <> 'object'
    or coalesce(p_theme->>'presetId', '') not in ('classic', 'competitive', 'night', 'custom')
    or coalesce(p_theme->>'navy', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'blue', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'blueDark', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'red', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'redDark', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'yellow', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'canvas', '') !~ '^#[0-9A-Fa-f]{6}$'
  then
    raise exception 'invalid_theme' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_services) item
    where jsonb_typeof(item) <> 'object'
      or nullif(btrim(item->>'id'), '') is null
      or char_length(item->>'id') > 80
      or nullif(btrim(item->>'title'), '') is null
      or char_length(item->>'title') > 80
      or nullif(btrim(item->>'description'), '') is null
      or char_length(item->>'description') > 220
      or char_length(coalesce(item->>'icon', '')) > 32
  ) then
    raise exception 'invalid_services' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_gallery) item
    where jsonb_typeof(item) <> 'object'
      or nullif(btrim(item->>'id'), '') is null
      or char_length(item->>'id') > 80
      or nullif(btrim(item->>'title'), '') is null
      or char_length(item->>'title') > 100
      or char_length(coalesce(item->>'imageUrl', '')) > 1200
      or (
        nullif(btrim(item->>'imageUrl'), '') is not null
        and btrim(item->>'imageUrl') !~* '^https?://'
        and btrim(item->>'imageUrl') !~ '^/images/[A-Za-z0-9._/-]+$'
      )
      or char_length(coalesce(item->>'altText', '')) > 180
  ) then
    raise exception 'invalid_gallery' using errcode = '22023';
  end if;

  insert into public.business_site_content (business_id, logo_url, services, gallery, theme, updated_by, updated_at)
  values (v_actor.business_id, v_logo_url, p_services, p_gallery, p_theme, v_actor.user_id, now())
  on conflict (business_id) do update set
    logo_url = excluded.logo_url,
    services = excluded.services,
    gallery = excluded.gallery,
    theme = excluded.theme,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_updated;

  return query
  select v_updated.business_id, v_updated.logo_url, v_updated.services, v_updated.gallery, v_updated.theme, v_updated.updated_at;
end;
$$;

drop function if exists public.get_public_platform_catalog(text, text);
create function public.get_public_platform_catalog(
  p_sport_slug text default null,
  p_city text default null
)
returns table (
  business_id uuid, business_slug text, business_name text, business_city text,
  business_country text, business_timezone text, logo_url text, cover_image_url text,
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
    site_content.logo_url, cover.image_url, cover.alt_text, rep.rating_average, coalesce(rep.review_count, 0)::bigint,
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
    and lower(coalesce(v.city, b.city, '')) = 'cajamarca'
    and (p_city is null or lower(trim(p_city)) = 'cajamarca')
    and (p_sport_slug is null or s.slug = p_sport_slug)
  order by b.name, v.sort_order, v.name, c.sort_order, c.name;
$$;

revoke all on function public.get_public_site_content(text) from public, anon, authenticated;
grant execute on function public.get_public_site_content(text) to anon, authenticated;

revoke all on function public.get_admin_site_content() from public, anon, authenticated;
grant execute on function public.get_admin_site_content() to authenticated;

revoke all on function public.admin_update_site_content(text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_site_content(text,jsonb,jsonb,jsonb) to authenticated;

revoke all on function public.get_public_platform_catalog(text,text) from public, anon, authenticated;
grant execute on function public.get_public_platform_catalog(text,text) to anon, authenticated;

revoke all on public.business_site_content from public, anon, authenticated;

comment on column public.business_site_content.logo_url is
  'Logo público opcional del negocio mostrado en las tarjetas de SportCenter Caxas.';
