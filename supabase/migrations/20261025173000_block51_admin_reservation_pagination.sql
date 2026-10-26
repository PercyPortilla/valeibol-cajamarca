-- Caxas Sport Center · Bloque 51
-- Historial administrativo filtrado y paginado en servidor por tenant.

create index if not exists reservations_business_history_page_idx
  on public.reservations (business_id, start_at desc, created_at desc, id desc);

create index if not exists reservations_business_unarchived_status_page_idx
  on public.reservations (business_id, status, start_at desc, created_at desc, id desc)
  where archived_at is null;

create index if not exists reservations_business_archived_page_idx
  on public.reservations (business_id, start_at desc, created_at desc, id desc)
  where archived_at is not null;

create or replace function public.get_admin_reservations_page(
  p_view text default 'active',
  p_limit integer default 41,
  p_cursor_start_at timestamptz default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
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
  v_view text;
  v_limit integer;
  v_cursor_parts integer;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  v_view := lower(trim(coalesce(p_view, '')));
  if v_view not in ('active', 'completed', 'cancelled', 'archived') then
    raise exception 'invalid_reservation_view' using errcode = '22023';
  end if;

  v_cursor_parts := num_nonnulls(p_cursor_start_at, p_cursor_created_at, p_cursor_id);
  if v_cursor_parts not in (0, 3) then
    raise exception 'invalid_reservation_cursor' using errcode = '22023';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 41), 101));

  return query
  select
    r.id,
    r.business_id,
    r.court_id,
    c.name,
    r.customer_id,
    cu.full_name,
    cu.phone_e164,
    r.start_at,
    r.end_at,
    r.status,
    r.lighting,
    r.net_height_cm,
    r.hourly_rate,
    r.total_amount,
    v_actor.currency,
    r.source,
    r.created_at,
    r.archived_at
  from public.reservations r
  join public.courts c
    on c.id = r.court_id
   and c.business_id = r.business_id
  left join public.customers cu
    on cu.id = r.customer_id
   and cu.business_id = r.business_id
  where r.business_id = v_actor.business_id
    and (
      (v_view = 'active' and r.archived_at is null and r.status in ('pending', 'confirmed'))
      or (v_view = 'completed' and r.archived_at is null and r.status = 'completed')
      or (v_view = 'cancelled' and r.archived_at is null and r.status = 'cancelled')
      or (v_view = 'archived' and r.archived_at is not null)
    )
    and (
      p_cursor_start_at is null
      or (r.start_at, r.created_at, r.id) < (p_cursor_start_at, p_cursor_created_at, p_cursor_id)
    )
  order by r.start_at desc, r.created_at desc, r.id desc
  limit v_limit;
end;
$$;

revoke all on function public.get_admin_reservations_page(text, integer, timestamptz, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.get_admin_reservations_page(text, integer, timestamptz, timestamptz, uuid)
  to authenticated;

comment on function public.get_admin_reservations_page(text, integer, timestamptz, timestamptz, uuid) is
  'B51: historial de reservas del tenant actual, filtrado antes del LIMIT y paginado por cursor keyset determinista.';
