-- Bloque 40 · reprogramación segura de reservas confirmadas.

alter table public.reservation_change_requests
  drop constraint if exists reservation_change_requests_request_type_check;

alter table public.reservation_change_requests
  add constraint reservation_change_requests_request_type_check
  check (request_type in ('cancellation','reschedule'));

alter table public.reservation_change_requests
  add column if not exists requested_court_id uuid references public.courts(id) on delete set null,
  add column if not exists requested_start_at timestamptz,
  add column if not exists requested_end_at timestamptz,
  add column if not exists requested_lighting public.lighting_mode,
  add column if not exists requested_hourly_rate numeric,
  add column if not exists requested_total_amount numeric;

alter table public.reservation_change_requests
  add constraint reservation_change_requests_requested_window_check
  check (
    request_type <> 'reschedule'
    or (
      requested_court_id is not null
      and requested_start_at is not null
      and requested_end_at is not null
      and requested_end_at > requested_start_at
      and requested_lighting is not null
      and requested_hourly_rate is not null
      and requested_hourly_rate > 0
      and requested_total_amount is not null
      and requested_total_amount > 0
    )
  );

drop index if exists public.reservation_change_requests_one_open_cancel;
create unique index if not exists reservation_change_requests_one_open_change
  on public.reservation_change_requests (reservation_id)
  where status = 'pending';

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
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_reservation_id is null then raise exception 'reservation_id_required' using errcode = '22023'; end if;
  if v_reason is not null and char_length(v_reason) > 500 then raise exception 'cancellation_reason_too_long' using errcode = '22023'; end if;
  if not exists (select 1 from public.user_accounts ua where ua.user_id = v_uid and ua.is_active) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id and r.user_id = v_uid
  for update;

  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;
  if v_reservation.status <> 'confirmed' then raise exception 'reservation_not_cancellable_by_request' using errcode = '22023'; end if;
  if v_reservation.start_at <= now() then raise exception 'reservation_change_window_closed' using errcode = '22023'; end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.reservation_id = v_reservation.id and q.status = 'pending'
  order by q.created_at desc
  limit 1
  for update;

  if found then
    if v_request.request_type = 'cancellation' then
      return query select v_request.id, v_request.status, v_request.created_at;
      return;
    end if;
    raise exception 'reservation_change_request_already_pending' using errcode = '23505';
  end if;

  insert into public.reservation_change_requests (
    reservation_id, business_id, user_id, request_type, status, customer_reason
  ) values (
    v_reservation.id, v_reservation.business_id, v_uid, 'cancellation', 'pending', v_reason
  ) returning * into v_request;

  return query select v_request.id, v_request.status, v_request.created_at;
end;
$$;

create or replace function public.request_my_reservation_reschedule(
  p_reservation_id uuid,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_reason text default null
)
returns table (
  request_id uuid,
  request_status text,
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  estimated_total_amount numeric
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
  v_target_court public.courts%rowtype;
  v_window record;
  v_rate public.pricing_rules%rowtype;
  v_lighting public.lighting_mode;
  v_total numeric;
  v_request public.reservation_change_requests%rowtype;
  v_payment public.reservation_payments%rowtype;
  v_currency text;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_reservation_id is null or p_court_id is null or p_date is null or p_start_time is null or p_end_time is null then
    raise exception 'invalid_reschedule_input' using errcode = '22023';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then raise exception 'reschedule_reason_too_long' using errcode = '22023'; end if;
  if not exists (select 1 from public.user_accounts ua where ua.user_id = v_uid and ua.is_active) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id and r.user_id = v_uid
  for update;

  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;
  if v_reservation.status <> 'confirmed' then raise exception 'reservation_not_reschedulable' using errcode = '22023'; end if;
  if v_reservation.start_at <= now() then raise exception 'reservation_change_window_closed' using errcode = '22023'; end if;
  select b.currency into v_currency from public.businesses b where b.id = v_reservation.business_id;

  select target.* into v_target_court
  from public.courts target
  join public.courts current on current.id = v_reservation.court_id
  where target.id = p_court_id
    and target.business_id = v_reservation.business_id
    and target.is_active
    and target.sport_id = current.sport_id;

  if not found then raise exception 'reschedule_court_not_eligible' using errcode = 'P0002'; end if;

  select * into v_window
  from public.phase6_resolve_window(v_reservation.business_id, p_court_id, p_date, p_start_time, p_end_time);

  if p_court_id = v_reservation.court_id
     and v_window.start_at = v_reservation.start_at
     and v_window.end_at = v_reservation.end_at then
    raise exception 'reschedule_no_change' using errcode = '22023';
  end if;

  v_lighting := public.resolve_booking_lighting(p_start_time, p_end_time);
  perform pg_advisory_xact_lock(hashtext(p_court_id::text || ':' || v_lighting::text));

  select pr.* into v_rate
  from public.pricing_rules pr
  where pr.court_id = p_court_id
    and pr.lighting = v_lighting
    and pr.is_active
    and p_date >= pr.effective_from
    and (pr.effective_until is null or p_date <= pr.effective_until)
  order by pr.effective_from desc
  limit 1;

  if not found then raise exception 'pricing_not_found' using errcode = 'P0002'; end if;
  v_total := round(v_rate.hourly_rate * v_window.duration_minutes / 60.0, 2);

  if exists (
    select 1
    from public.court_schedule_entries e
    where e.business_id = v_reservation.business_id
      and e.court_id = p_court_id
      and e.blocks_availability
      and not (e.source_kind = 'reservation' and e.source_id = v_reservation.id)
      and tstzrange(e.start_at, e.end_at, '[)') && tstzrange(v_window.start_at, v_window.end_at, '[)')
  ) then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end if;

  select rp.* into v_payment
  from public.reservation_payments rp
  where rp.reservation_id = v_reservation.id
    and rp.business_id = v_reservation.business_id
    and rp.status in ('reported','verified')
  order by rp.id
  limit 1
  for update;
  if found and (v_payment.amount <> v_total or v_payment.currency <> v_currency) then
    raise exception 'reservation_payment_requires_business_reschedule' using errcode = '22023';
  end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.reservation_id = v_reservation.id and q.status = 'pending'
  order by q.created_at desc
  limit 1
  for update;

  if found then
    if v_request.request_type = 'reschedule'
       and v_request.requested_court_id = p_court_id
       and v_request.requested_start_at = v_window.start_at
       and v_request.requested_end_at = v_window.end_at then
      return query select v_request.id, v_request.status, v_request.requested_start_at,
                          v_request.requested_end_at, v_request.requested_total_amount;
      return;
    end if;
    raise exception 'reservation_change_request_already_pending' using errcode = '23505';
  end if;

  insert into public.reservation_change_requests (
    reservation_id, business_id, user_id, request_type, status, customer_reason,
    requested_court_id, requested_start_at, requested_end_at, requested_lighting,
    requested_hourly_rate, requested_total_amount
  ) values (
    v_reservation.id, v_reservation.business_id, v_uid, 'reschedule', 'pending', v_reason,
    p_court_id, v_window.start_at, v_window.end_at, v_lighting,
    v_rate.hourly_rate, v_total
  ) returning * into v_request;

  return query select v_request.id, v_request.status, v_request.requested_start_at,
                      v_request.requested_end_at, v_request.requested_total_amount;
end;
$$;

drop function if exists public.get_my_reservations();
create function public.get_my_reservations()
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
  can_request_reschedule boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id, b.id, b.slug, b.name, b.phone, b.timezone,
    c.id, c.name, s.slug, s.name,
    r.start_at, r.end_at, r.status, r.lighting, r.net_height_cm, r.total_amount,
    b.currency, r.created_at,
    (
      r.status = 'pending' and r.source = 'public_web' and r.start_at > now()
      and not exists (
        select 1 from public.reservation_payments rp
        where rp.reservation_id = r.id and rp.business_id = r.business_id
          and rp.status in ('reported','verified')
      )
    ) as can_withdraw,
    (
      r.status = 'confirmed' and r.start_at > now()
      and not exists (select 1 from public.reservation_change_requests q where q.reservation_id = r.id and q.status = 'pending')
    ) as can_request_cancellation,
    (
      r.status = 'confirmed' and r.start_at > now()
      and not exists (select 1 from public.reservation_change_requests q where q.reservation_id = r.id and q.status = 'pending')
    ) as can_request_reschedule
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  join public.sports s on s.id = c.sport_id
  where r.user_id = (select auth.uid())
    and exists (select 1 from public.user_accounts ua where ua.user_id = (select auth.uid()) and ua.is_active)
  order by r.start_at desc, r.created_at desc;
$$;

drop function if exists public.get_my_reservation_change_requests();
create function public.get_my_reservation_change_requests()
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
  requested_total_amount numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.reservation_id, q.request_type, q.status, q.customer_reason,
         q.resolution_note, q.created_at, q.resolved_at,
         q.requested_court_id, q.requested_start_at, q.requested_end_at, q.requested_total_amount
  from public.reservation_change_requests q
  where q.user_id = (select auth.uid())
    and exists (select 1 from public.user_accounts ua where ua.user_id = (select auth.uid()) and ua.is_active)
  order by q.created_at desc;
$$;

drop function if exists public.get_admin_reservation_change_requests();
create function public.get_admin_reservation_change_requests()
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
  requested_total_amount numeric
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
  if not found then raise exception 'admin_profile_required' using errcode = '42501'; end if;

  return query
  select q.id, q.reservation_id, q.request_type, q.status, q.customer_reason,
         q.resolution_note, q.created_at, q.resolved_at,
         c.name, cu.full_name, cu.phone_e164, r.start_at, r.end_at,
         r.total_amount, v_actor.currency,
         q.requested_court_id, requested.name, q.requested_start_at, q.requested_end_at,
         q.requested_total_amount
  from public.reservation_change_requests q
  join public.reservations r on r.id = q.reservation_id and r.business_id = q.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.courts requested on requested.id = q.requested_court_id and requested.business_id = q.business_id
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
  v_target_court public.courts%rowtype;
  v_window record;
  v_rate public.pricing_rules%rowtype;
  v_lighting public.lighting_mode;
  v_total numeric;
  v_payment public.reservation_payments%rowtype;
  v_reservation_id uuid;
  v_note text := nullif(regexp_replace(trim(coalesce(p_resolution_note, '')), '\s+', ' ', 'g'), '');
  v_local_start timestamp;
  v_local_end timestamp;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner','admin') then
    raise exception 'reservation_change_resolution_forbidden' using errcode = '42501';
  end if;
  if p_request_id is null then raise exception 'change_request_id_required' using errcode = '22023'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'resolution_note_too_long' using errcode = '22023'; end if;

  select q.reservation_id into v_reservation_id
  from public.reservation_change_requests q
  where q.id = p_request_id and q.business_id = v_actor.business_id;
  if not found then raise exception 'change_request_not_found' using errcode = 'P0002'; end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = v_reservation_id and r.business_id = v_actor.business_id
  for update;
  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.business_id = v_actor.business_id
    and q.reservation_id = v_reservation.id
  for update;
  if not found then raise exception 'change_request_not_found' using errcode = 'P0002'; end if;

  if v_request.status <> 'pending' then
    if (p_approve and v_request.status = 'approved') or ((not p_approve) and v_request.status = 'rejected') then
      return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
      return;
    end if;
    raise exception 'change_request_already_resolved' using errcode = '22023';
  end if;

  if p_approve and v_request.request_type = 'cancellation' then
    if v_reservation.status = 'confirmed' then
      update public.reservations r
      set status = 'cancelled', last_modified_by = v_actor.user_id, status_changed_at = now()
      where r.id = v_reservation.id
      returning r.* into v_reservation;
    elsif v_reservation.status <> 'cancelled' then
      raise exception 'reservation_change_no_longer_applicable' using errcode = '22023';
    end if;
  elsif p_approve and v_request.request_type = 'reschedule' then
    if v_reservation.status <> 'confirmed' or v_reservation.start_at <= now() then
      raise exception 'reservation_change_no_longer_applicable' using errcode = '22023';
    end if;
    if v_request.requested_court_id is null or v_request.requested_start_at is null or v_request.requested_end_at is null then
      raise exception 'invalid_reschedule_request' using errcode = '22023';
    end if;

    select target.* into v_target_court
    from public.courts target
    join public.courts current on current.id = v_reservation.court_id
    where target.id = v_request.requested_court_id
      and target.business_id = v_actor.business_id
      and target.is_active
      and target.sport_id = current.sport_id;
    if not found then raise exception 'reschedule_court_not_eligible' using errcode = 'P0002'; end if;

    v_local_start := v_request.requested_start_at at time zone v_actor.timezone;
    v_local_end := v_request.requested_end_at at time zone v_actor.timezone;
    if v_local_start::date <> v_local_end::date then raise exception 'invalid_interval' using errcode = '22023'; end if;

    select * into v_window
    from public.phase6_resolve_window(
      v_actor.business_id,
      v_request.requested_court_id,
      v_local_start::date,
      v_local_start::time,
      v_local_end::time
    );

    v_lighting := public.resolve_booking_lighting(v_local_start::time, v_local_end::time);
    perform pg_advisory_xact_lock(hashtext(v_request.requested_court_id::text || ':' || v_lighting::text));

    select pr.* into v_rate
    from public.pricing_rules pr
    where pr.court_id = v_request.requested_court_id
      and pr.lighting = v_lighting
      and pr.is_active
      and v_local_start::date >= pr.effective_from
      and (pr.effective_until is null or v_local_start::date <= pr.effective_until)
    order by pr.effective_from desc
    limit 1;
    if not found then raise exception 'pricing_not_found' using errcode = 'P0002'; end if;

    v_total := round(v_rate.hourly_rate * v_window.duration_minutes / 60.0, 2);

    if v_request.requested_lighting <> v_lighting
       or v_request.requested_hourly_rate <> v_rate.hourly_rate
       or v_request.requested_total_amount <> v_total then
      raise exception 'reschedule_quote_changed' using errcode = '22023';
    end if;

    select rp.* into v_payment
    from public.reservation_payments rp
    where rp.reservation_id = v_reservation.id
      and rp.business_id = v_reservation.business_id
      and rp.status in ('reported','verified')
    order by rp.id
    limit 1
    for update;
    if found and (v_payment.amount <> v_total or v_payment.currency <> v_actor.currency) then
      raise exception 'reservation_payment_requires_business_reschedule' using errcode = '22023';
    end if;

    begin
      update public.reservations r
      set court_id = v_request.requested_court_id,
          start_at = v_window.start_at,
          end_at = v_window.end_at,
          lighting = v_lighting,
          hourly_rate = v_rate.hourly_rate,
          total_amount = v_total,
          last_modified_by = v_actor.user_id
      where r.id = v_reservation.id
      returning r.* into v_reservation;
    exception when exclusion_violation then
      raise exception 'slot_unavailable' using errcode = '23P01';
    end;

    update public.reservation_change_requests q
    set requested_lighting = v_lighting,
        requested_hourly_rate = v_rate.hourly_rate,
        requested_total_amount = v_total,
        updated_at = now()
    where q.id = v_request.id;
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

-- B40 cierra el bypass legado: una CONFIRMED ya no puede moverse desde la edición
-- administrativa genérica; debe usar el workflow de change request.
create or replace function public.admin_edit_reservation(
  p_reservation_id uuid,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_lighting public.lighting_mode,
  p_customer_name text,
  p_phone_e164 text
)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  court_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  lighting public.lighting_mode,
  hourly_rate numeric,
  total_amount numeric,
  currency text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_window record;
  v_rate public.pricing_rules%rowtype;
  v_customer_id uuid;
  v_reservation public.reservations%rowtype;
  v_name text;
  v_phone text;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then raise exception 'admin_profile_required' using errcode = '42501'; end if;
  if v_actor.role = 'staff' then raise exception 'insufficient_role' using errcode = '42501'; end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id and r.business_id = v_actor.business_id
  for update;
  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;
  if v_reservation.status = 'confirmed' then
    raise exception 'confirmed_reschedule_requires_request' using errcode = '22023';
  end if;
  if v_reservation.status <> 'pending' then
    raise exception 'reservation_not_editable' using errcode = '22023';
  end if;

  v_name := regexp_replace(trim(coalesce(p_customer_name, '')), '\s+', ' ', 'g');
  v_phone := trim(coalesce(p_phone_e164, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'invalid_customer_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone_e164' using errcode = '22023'; end if;
  if p_lighting is null then raise exception 'invalid_lighting' using errcode = '22023'; end if;

  select * into v_window
  from public.phase6_resolve_window(v_actor.business_id, p_court_id, p_date, p_start_time, p_end_time);

  select pr.* into v_rate
  from public.pricing_rules pr
  where pr.court_id = p_court_id
    and pr.lighting = p_lighting
    and pr.is_active
    and p_date >= pr.effective_from
    and (pr.effective_until is null or p_date <= pr.effective_until)
  order by pr.effective_from desc
  limit 1;
  if not found then raise exception 'pricing_not_found' using errcode = 'P0002'; end if;

  insert into public.customers (business_id, full_name, phone_e164)
  values (v_actor.business_id, v_name, v_phone)
  on conflict (business_id, phone_e164) where phone_e164 is not null and archived_at is null
  do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_customer_id;

  begin
    update public.reservations
    set court_id = p_court_id,
        customer_id = v_customer_id,
        start_at = v_window.start_at,
        end_at = v_window.end_at,
        lighting = p_lighting,
        hourly_rate = v_rate.hourly_rate,
        total_amount = round(v_rate.hourly_rate * v_window.duration_minutes / 60.0, 2),
        last_modified_by = v_actor.user_id
    where id = v_reservation.id
    returning * into v_reservation;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;

  return query select v_reservation.id, v_reservation.status, v_reservation.court_id,
    v_reservation.start_at, v_reservation.end_at, v_reservation.lighting,
    v_reservation.hourly_rate, v_reservation.total_amount, v_actor.currency;
end;
$$;

revoke all on function public.request_my_reservation_reschedule(uuid,uuid,date,time,time,text) from public, anon;
grant execute on function public.request_my_reservation_reschedule(uuid,uuid,date,time,time,text) to authenticated;
revoke all on function public.get_my_reservations() from public, anon;
grant execute on function public.get_my_reservations() to authenticated;
revoke all on function public.get_my_reservation_change_requests() from public, anon;
grant execute on function public.get_my_reservation_change_requests() to authenticated;
revoke all on function public.get_admin_reservation_change_requests() from public, anon;
grant execute on function public.get_admin_reservation_change_requests() to authenticated;

comment on function public.request_my_reservation_reschedule(uuid,uuid,date,time,time,text) is
  'B40: cliente solicita reprogramación de su confirmed futura; valida slot real, pricing y mismo deporte sin mover la reserva.';
comment on function public.admin_resolve_reservation_change_request(uuid,boolean,text) is
  'B40: OWNER/ADMIN resuelve cancelación o reprogramación; reschedule repricing y update son atómicos bajo EXCLUDE del ledger.';
comment on function public.admin_edit_reservation(uuid,uuid,date,time,time,public.lighting_mode,text,text) is
  'B40: edición administrativa genérica solo para PENDING; CONFIRMED debe reprogramarse mediante change request.';

