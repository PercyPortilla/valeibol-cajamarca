-- Bloque 25 · corrección segura de configuración estructural global del tenant.
-- Cierra la brecha de B20 para slug, moneda y zona horaria sin abrir PII tenant.

drop function if exists public.get_platform_admin_businesses_page(integer, integer);
create function public.get_platform_admin_businesses_page(
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  business_id uuid,
  slug text,
  name text,
  city text,
  country text,
  is_active boolean,
  configuration_status public.configuration_status,
  currency text,
  timezone text,
  venue_count bigint,
  court_count bigint,
  reservation_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.slug,
    b.name,
    b.city,
    b.country,
    b.is_active,
    b.configuration_status,
    b.currency,
    b.timezone,
    (select count(*) from public.venues v where v.business_id = b.id),
    (select count(*) from public.courts c where c.business_id = b.id),
    (select count(*) from public.reservations r where r.business_id = b.id)
  from public.businesses b
  order by b.created_at desc, b.name, b.id
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.platform_admin_update_business_core(
  p_business_id uuid,
  p_slug text,
  p_currency text,
  p_timezone text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_currency text := upper(trim(coalesce(p_currency, '')));
  v_timezone text := trim(coalesce(p_timezone, ''));
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;
  if p_business_id is null then
    raise exception 'invalid_business_id' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
    raise exception 'invalid_business_slug' using errcode = '22023';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency' using errcode = '22023';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = p_business_id
  for update;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  if v_business.configuration_status <> 'provisional' then
    raise exception 'business_must_be_unpublished_for_core_settings' using errcode = '22023';
  end if;

  if v_slug <> v_business.slug and exists (
    select 1 from public.businesses b where b.slug = v_slug and b.id <> v_business.id
  ) then
    raise exception 'business_slug_taken' using errcode = '23505';
  end if;

  if v_currency <> v_business.currency and exists (
    select 1 from public.reservations r where r.business_id = v_business.id
  ) then
    raise exception 'currency_change_blocked_by_reservation_history' using errcode = '22023';
  end if;

  if v_timezone <> v_business.timezone and (
    exists (select 1 from public.reservations r where r.business_id = v_business.id)
    or exists (select 1 from public.schedule_blocks sb where sb.business_id = v_business.id)
  ) then
    raise exception 'timezone_change_blocked_by_schedule_history' using errcode = '22023';
  end if;

  if v_slug = v_business.slug
     and v_currency = v_business.currency
     and v_timezone = v_business.timezone then
    return true;
  end if;

  update public.businesses
  set slug = v_slug,
      currency = v_currency,
      timezone = v_timezone,
      updated_at = now()
  where id = v_business.id;

  insert into public.availability_revisions (business_id, revision, updated_at)
  values (v_business.id, 1, now())
  on conflict (business_id) do update
    set revision = public.availability_revisions.revision + 1,
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.get_platform_admin_businesses_page(integer,integer) from public, anon, authenticated;
revoke all on function public.platform_admin_update_business_core(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.get_platform_admin_businesses_page(integer,integer) to authenticated;
grant execute on function public.platform_admin_update_business_core(uuid,text,text,text) to authenticated;

comment on function public.platform_admin_update_business_core(uuid,text,text,text) is
  'B25: ADMIN global corrige slug/moneda/timezone de un tenant no publicado; protege historia monetaria y temporal.';
