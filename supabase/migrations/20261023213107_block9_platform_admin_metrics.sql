-- Bloque 9 · Administrador global
-- Ajusta semántica de métricas y añade paginación sin romper la RPC histórica.
-- El ADMIN global opera mediante RPCs dedicadas: no hereda lectura directa de PII tenant.

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
      where b.id = target_business_id
        and b.owner_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.business_id = target_business_id
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
  select
    exists (
      select 1
      from public.businesses b
      where b.id = target_business_id
        and b.owner_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.business_id = target_business_id
        and p.is_active
        and p.role in ('owner', 'admin')
    );
$$;

drop policy if exists user_accounts_self_or_platform_admin_select on public.user_accounts;
drop policy if exists user_accounts_self_select on public.user_accounts;
create policy user_accounts_self_select on public.user_accounts
for select to authenticated
using (user_id = (select auth.uid()));

drop function if exists public.get_platform_admin_summary();

create function public.get_platform_admin_summary()
returns table (
  businesses_total bigint,
  businesses_active bigint,
  venues_active bigint,
  courts_active bigint,
  users_total bigint,
  reservations_total bigint
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
    (
      select count(*)
      from public.venues v
      join public.businesses b on b.id = v.business_id
      where v.is_active
        and b.is_active
    ),
    (
      select count(*)
      from public.courts c
      join public.venues v
        on v.id = c.venue_id
       and v.business_id = c.business_id
      join public.businesses b on b.id = c.business_id
      where c.is_active
        and v.is_active
        and b.is_active
    ),
    (select count(*) from public.user_accounts),
    (select count(*) from public.reservations);
end;
$$;

create or replace function public.get_platform_admin_businesses_page(
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
    (select count(*) from public.venues v where v.business_id = b.id),
    (select count(*) from public.courts c where c.business_id = b.id),
    (select count(*) from public.reservations r where r.business_id = b.id)
  from public.businesses b
  order by b.created_at desc, b.name, b.id
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_platform_admin_summary() from public, anon;
revoke all on function public.get_platform_admin_businesses(integer) from public, anon, authenticated;
revoke all on function public.get_platform_admin_businesses_page(integer,integer) from public, anon;

grant execute on function public.get_platform_admin_summary() to authenticated;
grant execute on function public.get_platform_admin_businesses_page(integer,integer) to authenticated;

comment on function public.get_platform_admin_businesses_page(integer,integer) is
  'Lista paginada cross-tenant para ADMIN global; omite identificadores de propietario y PII de clientes.';
