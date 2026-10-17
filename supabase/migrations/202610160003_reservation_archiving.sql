-- Valeibol · archivado reversible de reservas canceladas.
-- Mantiene la fila física para auditoría y oculta archivadas del historial principal.

alter table public.reservations
  add column if not exists archived_at timestamptz;

comment on column public.reservations.archived_at is
  'Archivado administrativo reversible. Solo aplica a reservas cancelled; la fila se conserva para auditoría.';

create index if not exists reservations_business_unarchived_history_idx
  on public.reservations (business_id, start_at desc, created_at desc)
  where archived_at is null;

create or replace function public.admin_archive_cancelled_reservation(p_reservation_id uuid)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  archived_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_reservation public.reservations%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if v_reservation.status <> 'cancelled' then
    raise exception 'reservation_not_cancelled' using errcode = '22023';
  end if;

  if v_reservation.archived_at is null then
    update public.reservations r
    set archived_at = now(),
        last_modified_by = v_actor.user_id
    where r.id = v_reservation.id
    returning * into v_reservation;
  end if;

  return query select
    v_reservation.id,
    v_reservation.status,
    v_reservation.archived_at,
    v_reservation.updated_at;
end;
$$;

create or replace function public.admin_restore_archived_reservation(p_reservation_id uuid)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  archived_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_reservation public.reservations%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if v_reservation.status <> 'cancelled' then
    raise exception 'reservation_not_cancelled' using errcode = '22023';
  end if;

  if v_reservation.archived_at is not null then
    update public.reservations r
    set archived_at = null,
        last_modified_by = v_actor.user_id
    where r.id = v_reservation.id
    returning * into v_reservation;
  end if;

  return query select
    v_reservation.id,
    v_reservation.status,
    v_reservation.archived_at,
    v_reservation.updated_at;
end;
$$;

revoke all on function public.admin_archive_cancelled_reservation(uuid) from public, anon, authenticated;
revoke all on function public.admin_restore_archived_reservation(uuid) from public, anon, authenticated;
grant execute on function public.admin_archive_cancelled_reservation(uuid) to authenticated;
grant execute on function public.admin_restore_archived_reservation(uuid) to authenticated;

-- Nueva firma para poder consultar también archivadas cuando la UI lo solicite.
-- La firma histórica cambia su RETURNS TABLE (añade archived_at), por eso debe recrearse.
drop function if exists public.get_admin_reservation_requests(integer);

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
  v_business_id uuid;
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select p.business_id into v_business_id
  from public.profiles p
  join public.businesses b on b.id = p.business_id and b.is_active
  where p.user_id = auth.uid()
    and p.is_active
    and p.role in ('owner', 'admin', 'staff')
  limit 1;

  if v_business_id is null then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 100), 200));
  return query
  select
    r.id, r.business_id, r.court_id, c.name, r.customer_id,
    cu.full_name, cu.phone_e164, r.start_at, r.end_at, r.status,
    r.lighting, r.net_height_cm, r.hourly_rate, r.total_amount,
    b.currency, r.source, r.created_at, r.archived_at
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
  where r.business_id = v_business_id
    and (coalesce(p_include_archived, false) or r.archived_at is null)
  order by r.start_at desc, r.created_at desc
  limit v_limit;
end;
$$;

-- Conserva la firma histórica para clientes existentes: por defecto oculta archivadas.
create or replace function public.get_admin_reservation_requests(p_limit integer default 100)
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
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.get_admin_reservation_requests(p_limit, false);
$$;

revoke all on function public.get_admin_reservation_requests(integer, boolean) from public, anon, authenticated;
revoke all on function public.get_admin_reservation_requests(integer) from public, anon, authenticated;
grant execute on function public.get_admin_reservation_requests(integer, boolean) to authenticated;
grant execute on function public.get_admin_reservation_requests(integer) to authenticated;

comment on function public.admin_archive_cancelled_reservation(uuid) is
  'Owner/admin: archiva idempotentemente una reserva cancelled del propio negocio sin eliminarla.';
comment on function public.admin_restore_archived_reservation(uuid) is
  'Owner/admin: restaura idempotentemente una reserva cancelled archivada del propio negocio.';
comment on function public.get_admin_reservation_requests(integer, boolean) is
  'Historial administrativo con opción explícita de incluir reservas archivadas.';
