-- Caxas Sport Center · Bloque 60
-- Pagina el historial de reservas del cliente por claves inmutables y evita
-- cargar todas sus solicitudes de cambio históricas en cada render de Mi cuenta.

create or replace function public.get_my_reservations_page(
  p_limit integer default 21,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  reservation_id uuid,
  business_id uuid,
  business_slug text,
  business_name text,
  business_phone text,
  business_timezone text,
  court_id uuid,
  court_name text,
  sport_slug text,
  sport_name text,
  start_at timestamptz,
  end_at timestamptz,
  status public.reservation_status,
  lighting public.lighting_mode,
  net_height_cm smallint,
  total_amount numeric,
  currency text,
  created_at timestamptz,
  can_withdraw boolean,
  can_request_cancellation boolean,
  can_request_reschedule boolean,
  closure_kind text,
  is_expired_pending boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = v_uid
      and ua.is_active
  ) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  if num_nonnulls(p_cursor_created_at, p_cursor_id) not in (0, 2) then
    raise exception 'invalid_customer_reservation_cursor' using errcode = '22023';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 21), 101));

  return query
  select
    r.id,
    b.id,
    b.slug,
    b.name,
    b.phone,
    b.timezone,
    c.id,
    c.name,
    s.slug,
    s.name,
    r.start_at,
    r.end_at,
    r.status,
    r.lighting,
    r.net_height_cm,
    r.total_amount,
    b.currency,
    r.created_at,
    (
      r.status = 'pending'
      and r.source = 'public_web'
      and r.start_at > now()
      and not exists (
        select 1
        from public.reservation_payments rp
        where rp.reservation_id = r.id
          and rp.business_id = r.business_id
          and rp.status in ('reported','verified')
      )
    ) as can_withdraw,
    (
      r.status = 'confirmed'
      and r.start_at > now()
      and not exists (
        select 1 from public.reservation_change_requests q
        where q.reservation_id = r.id and q.status = 'pending'
      )
    ) as can_request_cancellation,
    (
      r.status = 'confirmed'
      and r.start_at > now()
      and not exists (
        select 1 from public.reservation_change_requests q
        where q.reservation_id = r.id and q.status = 'pending'
      )
    ) as can_request_reschedule,
    r.closure_kind,
    (r.status = 'pending' and r.source = 'public_web' and r.start_at <= now()) as is_expired_pending
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  join public.sports s on s.id = c.sport_id
  where r.user_id = v_uid
    and (
      p_cursor_created_at is null
      or (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by r.created_at desc, r.id desc
  limit v_limit;
end;
$$;

create or replace function public.get_my_latest_reservation_change_requests(
  p_reservation_ids uuid[]
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
  requested_court_id uuid,
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  requested_total_amount numeric,
  requested_court_name text,
  initiator_kind text,
  proposal_note text,
  resolution_kind text,
  can_withdraw_request boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = v_uid
      and ua.is_active
  ) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  if p_reservation_ids is null or cardinality(p_reservation_ids) = 0 then
    return;
  end if;

  if cardinality(p_reservation_ids) > 100 then
    raise exception 'too_many_reservation_ids' using errcode = '22023';
  end if;

  return query
  with ranked as (
    select
      q.*,
      row_number() over (
        partition by q.reservation_id, q.request_type, q.initiator_kind
        order by q.created_at desc, q.id desc
      ) as rn
    from public.reservation_change_requests q
    join public.reservations owned
      on owned.id = q.reservation_id
     and owned.business_id = q.business_id
     and owned.user_id = v_uid
    where q.user_id = v_uid
      and q.reservation_id = any(p_reservation_ids)
  )
  select
    q.id,
    q.reservation_id,
    q.request_type,
    q.status,
    q.customer_reason,
    q.resolution_note,
    q.created_at,
    q.resolved_at,
    q.requested_court_id,
    q.requested_start_at,
    q.requested_end_at,
    q.requested_total_amount,
    requested.name,
    q.initiator_kind,
    q.proposal_note,
    q.resolution_kind,
    (
      q.status = 'pending'
      and q.initiator_kind = 'customer'
      and r.status = 'confirmed'
      and r.start_at > now()
      and (
        q.request_type <> 'reschedule'
        or (q.requested_start_at is not null and q.requested_start_at > now())
      )
    ) as can_withdraw_request
  from ranked q
  join public.reservations r
    on r.id = q.reservation_id
   and r.business_id = q.business_id
   and r.user_id = v_uid
  left join public.courts requested
    on requested.id = q.requested_court_id
   and requested.business_id = q.business_id
  where q.rn = 1
  order by q.created_at desc, q.id desc;
end;
$$;

create index if not exists reservations_customer_history_page_idx
  on public.reservations (user_id, created_at desc, id desc)
  where user_id is not null;

revoke all on function public.get_my_reservations_page(integer,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function public.get_my_reservations_page(integer,timestamptz,uuid)
  to authenticated;

revoke all on function public.get_my_latest_reservation_change_requests(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_my_latest_reservation_change_requests(uuid[])
  to authenticated;

comment on function public.get_my_reservations_page(integer,timestamptz,uuid) is
  'B60: historial propio paginado por created_at+id inmutables, identidad derivada de auth.uid().';
comment on function public.get_my_latest_reservation_change_requests(uuid[]) is
  'B60: último change request por tipo/iniciador para reservas propias visibles, acotado por IDs.';
