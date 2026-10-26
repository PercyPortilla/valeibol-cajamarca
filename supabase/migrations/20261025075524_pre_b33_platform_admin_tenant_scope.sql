-- Ajuste previo a B33 · alcance operativo del ADMIN global por tenant.
--
-- Regla final:
-- - /admin-global sigue reservado exclusivamente al ADMIN global.
-- - Cada OWNER/ADMIN/STAFF tenant conserva acceso únicamente a su negocio.
-- - El ADMIN global puede entrar al panel operativo de UN tenant seleccionado
--   explícitamente mediante el header x-platform-business-id.
-- - El header nunca concede privilegios por sí mismo: solo se honra cuando
--   auth.uid() pertenece a un user_accounts ADMIN global activo.

-- La administración principal queda deliberadamente en una sola cuenta activa.
-- No fija un correo/user_id en código: conserva al ADMIN global existente y
-- evita que se habilite un segundo ADMIN global simultáneo.
create unique index if not exists user_accounts_single_active_platform_admin
  on public.user_accounts ((1))
  where role = 'admin' and is_active;

create or replace function private.platform_admin_selected_business_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers jsonb;
  v_raw text;
  v_business_id uuid;
begin
  if auth.uid() is null or not public.is_platform_admin() then
    return null;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;

  v_raw := nullif(trim(coalesce(v_headers ->> 'x-platform-business-id', '')), '');
  if v_raw is null or v_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  v_business_id := v_raw::uuid;
  if not exists (
    select 1
    from public.businesses b
    where b.id = v_business_id
  ) then
    return null;
  end if;

  return v_business_id;
end;
$$;

revoke all on function private.platform_admin_selected_business_id() from public, anon, authenticated;

create or replace function public.get_current_admin_context()
returns table (
  user_id uuid,
  business_id uuid,
  business_name text,
  role public.app_role,
  display_name text,
  timezone text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_selected_business_id uuid;
begin
  v_selected_business_id := private.platform_admin_selected_business_id();

  if v_selected_business_id is not null then
    return query
    select
      ua.user_id,
      b.id,
      b.name,
      'admin'::public.app_role,
      ua.display_name,
      b.timezone
    from public.user_accounts ua
    join public.businesses b on b.id = v_selected_business_id
    where ua.user_id = auth.uid()
      and ua.is_active
      and ua.role = 'admin';
    return;
  end if;

  -- Un ADMIN global sin selección explícita no cae silenciosamente dentro de
  -- ningún tenant, aunque exista una fila histórica de profile.
  if public.is_platform_admin() then
    return;
  end if;

  return query
  select
    p.user_id,
    p.business_id,
    b.name,
    p.role,
    p.display_name,
    b.timezone
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where p.user_id = auth.uid()
    and p.is_active
    and b.is_active
    and p.role in ('owner', 'admin', 'staff')
  limit 1;
end;
$$;

create or replace function public.phase6_admin_actor()
returns table (
  user_id uuid,
  business_id uuid,
  role public.app_role,
  timezone text,
  currency text,
  booking_increment_minutes smallint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_selected_business_id uuid;
begin
  v_selected_business_id := private.platform_admin_selected_business_id();

  if v_selected_business_id is not null then
    return query
    select
      ua.user_id,
      b.id,
      'admin'::public.app_role,
      b.timezone,
      b.currency,
      b.booking_increment_minutes
    from public.user_accounts ua
    join public.businesses b on b.id = v_selected_business_id
    where ua.user_id = auth.uid()
      and ua.is_active
      and ua.role = 'admin';
    return;
  end if;

  if public.is_platform_admin() then
    return;
  end if;

  return query
  select
    p.user_id,
    p.business_id,
    p.role,
    b.timezone,
    b.currency,
    b.booking_increment_minutes
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where p.user_id = auth.uid()
    and p.is_active
    and b.is_active
    and p.role in ('owner', 'admin', 'staff')
  limit 1;
end;
$$;

create or replace function public.can_view_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.businesses b
      join public.profiles p on p.business_id = b.id
      where b.id = target_business_id
        and b.is_active
        and p.user_id = (select auth.uid())
        and p.is_active
        and p.role in ('owner', 'admin', 'staff')
    )
    or (
      public.is_platform_admin()
      and private.platform_admin_selected_business_id() = target_business_id
    );
$$;

create or replace function public.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.businesses b
      join public.profiles p on p.business_id = b.id
      where b.id = target_business_id
        and b.is_active
        and p.user_id = (select auth.uid())
        and p.is_active
        and p.role in ('owner', 'admin')
    )
    or (
      public.is_platform_admin()
      and private.platform_admin_selected_business_id() = target_business_id
    );
$$;

-- La lectura de reservas era una de las pocas RPC heredadas que seguía
-- resolviendo el tenant directamente desde profiles. Se alinea con el actor
-- central para que el ADMIN global seleccionado vea exactamente el mismo
-- panel que el dueño, sin ampliar el scope a otros negocios.
create or replace function public.get_admin_reservation_requests(
  p_limit integer,
  p_include_archived boolean
)
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
  created_at timestamptz,
  archived_at timestamptz
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

  v_limit := greatest(1, least(coalesce(p_limit, 100), 200));
  return query
  select
    r.id, r.business_id, r.court_id, c.name, r.customer_id,
    cu.full_name, cu.phone_e164, r.start_at, r.end_at, r.status,
    r.lighting, r.net_height_cm, r.hourly_rate, r.total_amount,
    v_actor.currency, r.source, r.created_at, r.archived_at
  from public.reservations r
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
  where r.business_id = v_actor.business_id
    and (coalesce(p_include_archived, false) or r.archived_at is null)
  order by r.start_at desc, r.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.get_current_admin_context() from public, anon, authenticated;
revoke all on function public.phase6_admin_actor() from public, anon, authenticated;
revoke all on function public.can_view_business(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_business(uuid) from public, anon, authenticated;
revoke all on function public.get_admin_reservation_requests(integer, boolean) from public, anon, authenticated;

grant execute on function public.get_current_admin_context() to authenticated;
grant execute on function public.can_view_business(uuid) to authenticated;
grant execute on function public.can_manage_business(uuid) to authenticated;
grant execute on function public.get_admin_reservation_requests(integer, boolean) to authenticated;

comment on function private.platform_admin_selected_business_id() is
  'Scope explícito del ADMIN global: honra x-platform-business-id solo para una cuenta ADMIN global activa y un tenant existente.';
comment on function public.phase6_admin_actor() is
  'Actor administrativo tenant. Owners/admin/staff usan profile; ADMIN global usa únicamente el tenant seleccionado explícitamente por header.';

-- Alcance público temporal de Caxas Sport Center: únicamente Cajamarca.
-- Se mantiene la firma pública para no romper clientes existentes, pero un
-- p_city distinto de Cajamarca devuelve vacío y p_city null también queda
-- limitado a Cajamarca.
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
    and lower(coalesce(v.city, b.city, '')) = 'cajamarca'
    and (p_city is null or lower(trim(p_city)) = 'cajamarca')
    and (p_sport_slug is null or s.slug = p_sport_slug)
  order by b.name, v.sort_order, v.name, c.sort_order, c.name;
$$;

revoke all on function public.get_public_platform_catalog(text,text) from public;
grant execute on function public.get_public_platform_catalog(text,text) to anon, authenticated;

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
    join public.courts c on c.id = new.court_id and c.business_id = b.id
    join public.venues v on v.id = c.venue_id and v.business_id = b.id
    where b.id = new.business_id
      and b.is_active
      and b.configuration_status = 'confirmed'
      and lower(coalesce(v.city, b.city, '')) = 'cajamarca'
  ) then
    raise exception 'business_not_published_in_cajamarca' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_new_reservation_business_published() from public, anon, authenticated;
