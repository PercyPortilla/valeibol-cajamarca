-- Caxas Sport Center · Bloque 53
-- Exportación administrativa completa sin truncamiento por límites de PostgREST.

create or replace function public.get_admin_export_reservations_page(
  p_from date,
  p_to date,
  p_limit integer default 500,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_snapshot_created_at timestamptz default null,
  p_snapshot_id uuid default null
)
returns table (
  reservation_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone_e164 text,
  marketing_opt_in boolean,
  court_id uuid,
  court_name text,
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
  updated_at timestamptz,
  export_snapshot_created_at timestamptz,
  export_snapshot_id uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 500));
  v_snapshot_created_at timestamptz := p_snapshot_created_at;
  v_snapshot_id uuid := p_snapshot_id;
begin
  if p_from is null or p_to is null or p_to < p_from or (p_to - p_from) > 366 then
    raise exception 'invalid_date_range' using errcode = '22023';
  end if;

  if num_nonnulls(p_cursor_created_at, p_cursor_id) not in (0, 2) then
    raise exception 'invalid_export_cursor' using errcode = '22023';
  end if;
  if num_nonnulls(p_snapshot_created_at, p_snapshot_id) not in (0, 2) then
    raise exception 'invalid_export_snapshot' using errcode = '22023';
  end if;

  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if v_snapshot_created_at is null then
    select r.created_at, r.id
      into v_snapshot_created_at, v_snapshot_id
    from public.reservations r
    where r.business_id = v_actor.business_id
      and (r.start_at at time zone v_actor.timezone)::date between p_from and p_to
    order by r.created_at desc, r.id desc
    limit 1;
  end if;

  return query
  select
    r.id, r.customer_id, cu.full_name, cu.phone_e164,
    coalesce(cu.marketing_opt_in, false),
    r.court_id, c.name, r.start_at, r.end_at, r.status, r.lighting,
    r.net_height_cm, r.hourly_rate, r.total_amount, v_actor.currency,
    r.source, r.created_at, r.updated_at,
    v_snapshot_created_at, v_snapshot_id
  from public.reservations r
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
  where r.business_id = v_actor.business_id
    and (r.start_at at time zone v_actor.timezone)::date between p_from and p_to
    and (
      v_snapshot_created_at is null
      or (r.created_at, r.id) <= (v_snapshot_created_at, v_snapshot_id)
    )
    and (
      p_cursor_created_at is null
      or (r.created_at, r.id) > (p_cursor_created_at, p_cursor_id)
    )
  order by r.created_at asc, r.id asc
  limit v_limit;
end;
$$;

revoke all on function public.get_admin_export_reservations_page(date,date,integer,timestamptz,uuid,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function public.get_admin_export_reservations_page(date,date,integer,timestamptz,uuid,timestamptz,uuid)
  to authenticated;

create index if not exists reservations_business_created_id_idx
  on public.reservations (business_id, created_at asc, id asc);

comment on function public.get_admin_export_reservations_page(date,date,integer,timestamptz,uuid,timestamptz,uuid) is
  'B53: export tenant-scoped paginado por keyset created_at+id con snapshot superior fijo para evitar truncamiento y crecimiento del conjunto durante la exportación.';
