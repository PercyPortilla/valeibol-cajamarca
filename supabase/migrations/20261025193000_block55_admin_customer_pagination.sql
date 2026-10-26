-- Caxas Sport Center · Bloque 55
-- Elimina topes silenciosos del directorio privado de clientes y del historial
-- de reservas por cliente usando paginación keyset server-side.

create or replace function public.get_admin_customers_page(
  p_limit integer default 31,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
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

  if num_nonnulls(p_cursor_created_at, p_cursor_id) not in (0, 2) then
    raise exception 'invalid_customer_cursor' using errcode = '22023';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 31), 101));

  return query
  with customer_stats as (
    select
      c.id as customer_id,
      c.full_name,
      c.phone_e164,
      c.marketing_opt_in,
      c.created_at as customer_created_at,
      greatest(c.updated_at, coalesce(max(r.updated_at), c.updated_at)) as last_activity_at,
      max(r.start_at) filter (where r.status <> 'cancelled') as last_reservation_at,
      count(r.id) as reservation_count,
      count(r.id) filter (where r.status in ('pending', 'confirmed')) as active_reservation_count,
      count(r.id) filter (where r.status = 'completed') as completed_reservation_count,
      count(r.id) filter (where r.status = 'cancelled') as cancelled_reservation_count,
      coalesce(sum(r.total_amount) filter (where r.status = 'confirmed'), 0)::numeric as confirmed_value,
      coalesce(sum(r.total_amount) filter (where r.status = 'completed'), 0)::numeric as completed_value
    from public.customers c
    left join public.reservations r
      on r.customer_id = c.id
     and r.business_id = c.business_id
    where c.business_id = v_actor.business_id
      and c.archived_at is null
    group by c.id, c.full_name, c.phone_e164, c.marketing_opt_in, c.created_at, c.updated_at
  )
  select
    s.customer_id,
    s.full_name,
    s.phone_e164,
    s.marketing_opt_in,
    s.customer_created_at,
    s.last_activity_at,
    s.last_reservation_at,
    s.reservation_count,
    s.active_reservation_count,
    s.completed_reservation_count,
    s.cancelled_reservation_count,
    s.confirmed_value,
    s.completed_value,
    v_actor.currency
  from customer_stats s
  where p_cursor_created_at is null
     or (s.customer_created_at, s.customer_id) < (p_cursor_created_at, p_cursor_id)
  order by s.customer_created_at desc, s.customer_id desc
  limit v_limit;
end;
$$;

create or replace function public.get_admin_customer_summary(p_customer_id uuid)
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
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
      and c.business_id = v_actor.business_id
      and c.archived_at is null
  ) then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

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
  where c.id = p_customer_id
    and c.business_id = v_actor.business_id
    and c.archived_at is null
  group by c.id, c.full_name, c.phone_e164, c.marketing_opt_in, c.created_at, c.updated_at;
end;
$$;

create or replace function public.get_admin_customer_history_page(
  p_customer_id uuid,
  p_limit integer default 26,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  reservation_id uuid,
  court_id uuid,
  court_name text,
  start_at timestamptz,
  end_at timestamptz,
  status public.reservation_status,
  lighting public.lighting_mode,
  net_height_cm smallint,
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

  if num_nonnulls(p_cursor_created_at, p_cursor_id) not in (0, 2) then
    raise exception 'invalid_customer_history_cursor' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.business_id = v_actor.business_id
      and c.archived_at is null
  ) then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 26), 101));

  return query
  select
    r.id,
    r.court_id,
    c.name,
    r.start_at,
    r.end_at,
    r.status,
    r.lighting,
    r.net_height_cm,
    r.hourly_rate,
    r.total_amount,
    r.source,
    r.created_at,
    r.updated_at,
    v_actor.currency
  from public.reservations r
  join public.courts c
    on c.id = r.court_id
   and c.business_id = r.business_id
  where r.business_id = v_actor.business_id
    and r.customer_id = p_customer_id
    and (
      p_cursor_created_at is null
      or (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by r.created_at desc, r.id desc
  limit v_limit;
end;
$$;

create index if not exists reservations_business_customer_updated_idx
  on public.reservations (business_id, customer_id, updated_at desc);

create index if not exists reservations_business_customer_history_page_idx
  on public.reservations (business_id, customer_id, created_at desc, id desc);

revoke all on function public.get_admin_customers_page(integer,timestamptz,uuid)
  from public, anon, authenticated;
revoke all on function public.get_admin_customer_summary(uuid)
  from public, anon, authenticated;
revoke all on function public.get_admin_customer_history_page(uuid,integer,timestamptz,uuid)
  from public, anon, authenticated;

grant execute on function public.get_admin_customers_page(integer,timestamptz,uuid)
  to authenticated;
grant execute on function public.get_admin_customer_summary(uuid)
  to authenticated;
grant execute on function public.get_admin_customer_history_page(uuid,integer,timestamptz,uuid)
  to authenticated;

comment on function public.get_admin_customers_page(integer,timestamptz,uuid) is
  'B55: directorio privado de clientes paginado por keyset inmutable created_at+id dentro del tenant derivado del actor.';
comment on function public.get_admin_customer_history_page(uuid,integer,timestamptz,uuid) is
  'B55: historial privado de reservas de un cliente paginado por keyset inmutable created_at+id y tenant.';
