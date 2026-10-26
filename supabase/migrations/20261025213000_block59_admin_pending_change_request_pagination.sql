-- Caxas Sport Center · Bloque 59
-- Evita cargar todo el historial de solicitudes de cambio en cada render del
-- panel de reservas. El panel operativo pagina solo pendientes y las tarjetas
-- visibles consultan su flag pending de forma acotada y tenant-scoped.

create or replace function public.get_admin_pending_reservation_change_requests_page(
  p_limit integer default 21,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  request_id uuid,
  reservation_id uuid,
  request_type text,
  request_status text,
  customer_reason text,
  resolution_note text,
  created_at timestamptz,
  resolved_at timestamptz,
  court_name text,
  customer_name text,
  customer_phone_e164 text,
  start_at timestamptz,
  end_at timestamptz,
  current_total_amount numeric,
  currency text,
  requested_court_id uuid,
  requested_court_name text,
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  requested_total_amount numeric,
  initiator_kind text,
  proposal_note text,
  resolution_kind text
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
    raise exception 'invalid_admin_change_request_cursor' using errcode = '22023';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 21), 51));

  return query
  select
    q.id,
    q.reservation_id,
    q.request_type,
    q.status,
    q.customer_reason,
    q.resolution_note,
    q.created_at,
    q.resolved_at,
    c.name,
    cu.full_name,
    cu.phone_e164,
    r.start_at,
    r.end_at,
    r.total_amount,
    v_actor.currency,
    q.requested_court_id,
    requested.name,
    q.requested_start_at,
    q.requested_end_at,
    q.requested_total_amount,
    q.initiator_kind,
    q.proposal_note,
    q.resolution_kind
  from public.reservation_change_requests q
  join public.reservations r
    on r.id = q.reservation_id
   and r.business_id = q.business_id
  join public.courts c
    on c.id = r.court_id
   and c.business_id = r.business_id
  left join public.courts requested
    on requested.id = q.requested_court_id
   and requested.business_id = q.business_id
  left join public.customers cu
    on cu.id = r.customer_id
   and cu.business_id = r.business_id
  where q.business_id = v_actor.business_id
    and q.status = 'pending'
    and (
      p_cursor_created_at is null
      or (q.created_at, q.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by q.created_at desc, q.id desc
  limit v_limit;
end;
$$;

create or replace function public.get_admin_pending_change_reservation_ids(
  p_reservation_ids uuid[]
)
returns table (reservation_id uuid)
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

  if p_reservation_ids is null or cardinality(p_reservation_ids) = 0 then
    return;
  end if;

  if cardinality(p_reservation_ids) > 100 then
    raise exception 'too_many_reservation_ids' using errcode = '22023';
  end if;

  return query
  select distinct q.reservation_id
  from public.reservation_change_requests q
  where q.business_id = v_actor.business_id
    and q.status = 'pending'
    and q.reservation_id = any(p_reservation_ids);
end;
$$;

create index if not exists reservation_change_requests_admin_pending_page_idx
  on public.reservation_change_requests (business_id, created_at desc, id desc)
  where status = 'pending';

revoke all on function public.get_admin_pending_reservation_change_requests_page(integer,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function public.get_admin_pending_reservation_change_requests_page(integer,timestamptz,uuid)
  to authenticated;

revoke all on function public.get_admin_pending_change_reservation_ids(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_admin_pending_change_reservation_ids(uuid[])
  to authenticated;

comment on function public.get_admin_pending_reservation_change_requests_page(integer,timestamptz,uuid) is
  'B59: solicitudes de cambio pendientes paginadas por created_at+id dentro del tenant activo.';
comment on function public.get_admin_pending_change_reservation_ids(uuid[]) is
  'B59: flags pending para un conjunto acotado de reservas visibles dentro del tenant activo.';
