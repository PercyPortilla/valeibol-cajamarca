-- Bloque 39 · solicitudes formales de cancelación para reservas confirmadas.

create table if not exists public.reservation_change_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.user_accounts(user_id) on delete set null,
  request_type text not null check (request_type = 'cancellation'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  customer_reason text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  check (customer_reason is null or char_length(customer_reason) <= 500),
  check (resolution_note is null or char_length(resolution_note) <= 500),
  constraint reservation_change_requests_resolution_lifecycle_check check (
    (status = 'pending' and resolved_by is null and resolved_at is null)
    or (status in ('approved','rejected') and resolved_by is not null and resolved_at is not null)
  )
);

create unique index if not exists reservation_change_requests_one_open_cancel
  on public.reservation_change_requests (reservation_id)
  where request_type = 'cancellation' and status = 'pending';

create index if not exists reservation_change_requests_business_status_idx
  on public.reservation_change_requests (business_id, status, created_at desc);

alter table public.reservation_change_requests enable row level security;
revoke all on public.reservation_change_requests from anon, authenticated;

drop function if exists public.get_my_reservations();

create function public.get_my_reservations()
returns table (
  reservation_id uuid,
  business_id uuid,
  business_slug text,
  business_name text,
  business_phone text,
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
  can_request_cancellation boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id,
    b.id,
    b.slug,
    b.name,
    b.phone,
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
        select 1 from public.reservation_payments rp
        where rp.reservation_id = r.id
          and rp.business_id = r.business_id
          and rp.status in ('reported', 'verified')
      )
    ) as can_withdraw,
    (
      r.status = 'confirmed'
      and r.start_at > now()
      and not exists (
        select 1 from public.reservation_change_requests q
        where q.reservation_id = r.id
          and q.request_type = 'cancellation'
          and q.status = 'pending'
      )
    ) as can_request_cancellation
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  join public.sports s on s.id = c.sport_id
  where r.user_id = (select auth.uid())
    and exists (
      select 1 from public.user_accounts ua
      where ua.user_id = (select auth.uid()) and ua.is_active
    )
  order by r.start_at desc, r.created_at desc;
$$;

revoke all on function public.get_my_reservations() from public, anon;
grant execute on function public.get_my_reservations() to authenticated;

create or replace function public.request_my_reservation_cancellation(
  p_reservation_id uuid,
  p_reason text default null
)
returns table (
  request_id uuid,
  request_status text,
  created_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := nullif(regexp_replace(trim(coalesce(p_reason, '')), '\s+', ' ', 'g'), '');
  v_reservation public.reservations%rowtype;
  v_request public.reservation_change_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_reservation_id is null then
    raise exception 'reservation_id_required' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'cancellation_reason_too_long' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_accounts ua where ua.user_id = v_uid and ua.is_active) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.user_id = v_uid
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception 'reservation_not_cancellable_by_request' using errcode = '22023';
  end if;
  if v_reservation.start_at <= now() then
    raise exception 'reservation_change_window_closed' using errcode = '22023';
  end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.reservation_id = v_reservation.id
    and q.request_type = 'cancellation'
    and q.status = 'pending'
  order by q.created_at desc
  limit 1
  for update;

  if found then
    return query select v_request.id, v_request.status, v_request.created_at;
    return;
  end if;

  insert into public.reservation_change_requests (
    reservation_id, business_id, user_id, request_type, status, customer_reason
  ) values (
    v_reservation.id, v_reservation.business_id, v_uid, 'cancellation', 'pending', v_reason
  )
  returning * into v_request;

  return query select v_request.id, v_request.status, v_request.created_at;
end;
$$;

create or replace function public.get_my_reservation_change_requests()
returns table (
  request_id uuid,
  reservation_id uuid,
  request_type text,
  request_status text,
  customer_reason text,
  resolution_note text,
  created_at timestamptz,
  resolved_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.reservation_id, q.request_type, q.status, q.customer_reason,
         q.resolution_note, q.created_at, q.resolved_at
  from public.reservation_change_requests q
  where q.user_id = (select auth.uid())
    and exists (
      select 1 from public.user_accounts ua
      where ua.user_id = (select auth.uid()) and ua.is_active
    )
  order by q.created_at desc;
$$;

create or replace function public.get_admin_reservation_change_requests()
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
  end_at timestamptz
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

  return query
  select q.id, q.reservation_id, q.request_type, q.status, q.customer_reason,
         q.resolution_note, q.created_at, q.resolved_at,
         c.name, cu.full_name, cu.phone_e164, r.start_at, r.end_at
  from public.reservation_change_requests q
  join public.reservations r on r.id = q.reservation_id and r.business_id = q.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
  where q.business_id = v_actor.business_id
  order by case when q.status = 'pending' then 0 else 1 end, q.created_at desc;
end;
$$;

create or replace function public.admin_resolve_reservation_change_request(
  p_request_id uuid,
  p_approve boolean,
  p_resolution_note text default null
)
returns table (
  request_id uuid,
  request_status text,
  reservation_id uuid,
  reservation_status public.reservation_status
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_request public.reservation_change_requests%rowtype;
  v_reservation public.reservations%rowtype;
  v_reservation_id uuid;
  v_note text := nullif(regexp_replace(trim(coalesce(p_resolution_note, '')), '\s+', ' ', 'g'), '');
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner','admin') then
    raise exception 'reservation_change_resolution_forbidden' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'change_request_id_required' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'resolution_note_too_long' using errcode = '22023';
  end if;

  select q.reservation_id into v_reservation_id
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.business_id = v_actor.business_id
    and q.request_type = 'cancellation';

  if not found then
    raise exception 'change_request_not_found' using errcode = 'P0002';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = v_reservation_id
    and r.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.business_id = v_actor.business_id
    and q.reservation_id = v_reservation.id
    and q.request_type = 'cancellation'
  for update;

  if not found then
    raise exception 'change_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    if (p_approve and v_request.status = 'approved') or ((not p_approve) and v_request.status = 'rejected') then
      return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
      return;
    end if;
    raise exception 'change_request_already_resolved' using errcode = '22023';
  end if;

  if p_approve then
    if v_reservation.status = 'confirmed' then
      update public.reservations r
      set status = 'cancelled',
          last_modified_by = v_actor.user_id,
          status_changed_at = now()
      where r.id = v_reservation.id
      returning r.* into v_reservation;
    elsif v_reservation.status <> 'cancelled' then
      raise exception 'reservation_change_no_longer_applicable' using errcode = '22023';
    end if;
  end if;

  update public.reservation_change_requests q
  set status = case when p_approve then 'approved' else 'rejected' end,
      resolved_by = v_actor.user_id,
      resolution_note = v_note,
      resolved_at = now(),
      updated_at = now()
  where q.id = v_request.id
  returning q.* into v_request;

  return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
end;
$$;

revoke all on function public.request_my_reservation_cancellation(uuid,text) from public, anon;
grant execute on function public.request_my_reservation_cancellation(uuid,text) to authenticated;
revoke all on function public.get_my_reservation_change_requests() from public, anon;
grant execute on function public.get_my_reservation_change_requests() to authenticated;
revoke all on function public.get_admin_reservation_change_requests() from public, anon;
grant execute on function public.get_admin_reservation_change_requests() to authenticated;
revoke all on function public.admin_resolve_reservation_change_request(uuid,boolean,text) from public, anon;
grant execute on function public.admin_resolve_reservation_change_request(uuid,boolean,text) to authenticated;

