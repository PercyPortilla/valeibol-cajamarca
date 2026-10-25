-- Bloque 15 · portada visual del catálogo multi-tenant.
-- Reutiliza business_site_content.gallery y expone solo la primera imagen pública visible.

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
  cover_image_url text,
  cover_alt_text text,
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
  select
    b.id,
    b.slug,
    b.name,
    b.city,
    b.country,
    cover.image_url,
    cover.alt_text,
    v.id,
    v.slug,
    v.name,
    v.city,
    v.address,
    v.latitude,
    v.longitude,
    c.id,
    c.slug,
    c.name,
    c.surface,
    s.id,
    s.slug,
    s.name,
    rates.price_from,
    b.currency
  from public.businesses b
  join public.venues v
    on v.business_id = b.id
   and v.is_active
  join public.courts c
    on c.business_id = b.id
   and c.venue_id = v.id
   and c.is_active
  join public.sports s
    on s.id = c.sport_id
   and s.is_active
  left join public.business_site_content site_content
    on site_content.business_id = b.id
  left join lateral (
    select
      nullif(btrim(item->>'imageUrl'), '') as image_url,
      nullif(btrim(item->>'altText'), '') as alt_text
    from jsonb_array_elements(coalesce(site_content.gallery, '[]'::jsonb)) item
    where lower(coalesce(item->>'isVisible', 'true')) not in ('false', 'f', 'no', 'n', '0', 'off')
      and nullif(btrim(item->>'imageUrl'), '') is not null
    order by
      case
        when coalesce(item->>'sortOrder', '') ~ '^[0-9]{1,4}$' then (item->>'sortOrder')::integer
        else 0
      end,
      coalesce(item->>'id', '')
    limit 1
  ) cover on true
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

revoke all on function public.get_public_platform_catalog(text, text) from public;
grant execute on function public.get_public_platform_catalog(text, text) to anon, authenticated;

comment on function public.get_public_platform_catalog(text, text) is
  'Catálogo público multi-tenant sanitizado. Incluye una sola portada derivada de la primera foto visible de la galería administrable.';
