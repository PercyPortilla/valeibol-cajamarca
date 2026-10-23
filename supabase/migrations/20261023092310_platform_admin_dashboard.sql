-- Plataforma global · Bloque 9
-- Administración cross-tenant separada del admin operativo de cada negocio.

create or replace function public.get_platform_admin_context()
returns table (
  user_id uuid,
  display_name text,
  role public.platform_role
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ua.user_id, ua.display_name, ua.role
  from public.user_accounts ua
  where ua.user_id = (select auth.uid())
    and ua.is_active
    and ua.role = 'admin';
$$;

create or replace function public.get_platform_admin_summary()
returns table (
  businesses_total bigint,
  businesses_active bigint,
  venues_active bigint,
  courts_active bigint,
  users_total bigint,
  reservations_total bigint,
  payment_reports_total bigint
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
    (select count(*) from public.businesses),
    (select count(*) from public.businesses where is_active),
    (select count(*) from public.venues where is_active),
    (select count(*) from public.courts where is_active),
    (select count(*) from public.user_accounts where is_active),
    (select count(*) from public.reservations),
    (select count(*) from public.reservation_payments);
end;
$$;

create or replace function public.get_platform_admin_businesses(p_limit integer default 200)
returns table (
  business_id uuid,
  slug text,
  name text,
  city text,
  country text,
  is_active boolean,
  owner_user_id uuid,
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
    b.owner_user_id,
    (select count(*) from public.venues v where v.business_id = b.id),
    (select count(*) from public.courts c where c.business_id = b.id),
    (select count(*) from public.reservations r where r.business_id = b.id)
  from public.businesses b
  order by b.created_at desc, b.name
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;

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
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;
  if p_business_id is null or p_active is null then
    raise exception 'invalid_business_state' using errcode = '22023';
  end if;

  update public.businesses
  set is_active = p_active,
      updated_at = now()
  where id = p_business_id;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

revoke all on function public.get_platform_admin_context() from public, anon;
revoke all on function public.get_platform_admin_summary() from public, anon;
revoke all on function public.get_platform_admin_businesses(integer) from public, anon;
revoke all on function public.platform_admin_set_business_active(uuid,boolean) from public, anon;

grant execute on function public.get_platform_admin_context() to authenticated;
grant execute on function public.get_platform_admin_summary() to authenticated;
grant execute on function public.get_platform_admin_businesses(integer) to authenticated;
grant execute on function public.platform_admin_set_business_active(uuid,boolean) to authenticated;

comment on function public.get_platform_admin_context() is
  'Contexto de administrador global. Solo user_accounts.role=admin; no confundir con profiles.role=admin de un negocio.';
comment on function public.platform_admin_set_business_active(uuid,boolean) is
  'Activa/desactiva un tenant sin borrarlo. Requiere ADMIN global explícito.';
