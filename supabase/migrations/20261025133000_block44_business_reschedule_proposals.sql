-- Bloque 44 · propuesta de reprogramación iniciada por OWNER/ADMIN.
-- Reutiliza reservation_change_requests y conserva el orden de locks
-- reservation -> change_request para no crear un lifecycle paralelo.

alter table public.reservation_change_requests
  add column if not exists initiator_kind text,
  add column if not exists initiated_by uuid references auth.users(id) on delete set null,
  add column if not exists proposal_note text;

update public.reservation_change_requests
set initiator_kind = coalesce(initiator_kind, 'customer'),
    initiated_by = coalesce(initiated_by, user_id)
where initiator_kind is null or initiated_by is null;

alter table public.reservation_change_requests
  alter column initiator_kind set default 'customer',
  alter column initiator_kind set not null,
  alter column initiated_by set default auth.uid();

alter table public.reservation_change_requests
  drop constraint if exists reservation_change_requests_initiator_kind_check;
alter table public.reservation_change_requests
  add constraint reservation_change_requests_initiator_kind_check
  check (initiator_kind in ('customer','business'));

alter table public.reservation_change_requests
  drop constraint if exists reservation_change_requests_business_proposal_check;
alter table public.reservation_change_requests
  add constraint reservation_change_requests_business_proposal_check
  check (
    initiator_kind <> 'business'
    or (
      request_type = 'reschedule'
      and user_id is not null
      and initiated_by is not null
    )
  );

alter table public.reservation_change_requests
  drop constraint if exists reservation_change_requests_proposal_note_check;
alter table public.reservation_change_requests
  add constraint reservation_change_requests_proposal_note_check
  check (proposal_note is null or char_length(proposal_note) <= 500);

-- Una propuesta del negocio solo puede ser resuelta por el cliente destinatario.
-- Esto también impide que admin_resolve_reservation_change_request() la apruebe
-- por accidente: el caller autenticado sigue siendo visible dentro del trigger.
create or replace function public.block44_guard_business_proposal_resolution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.initiator_kind = 'business'
     and old.status = 'pending'
     and new.status in ('approved','rejected')
     and auth.uid() is distinct from old.user_id then
    raise exception 'business_reschedule_requires_customer_response' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists reservation_change_requests_block44_resolution_guard on public.reservation_change_requests;
create trigger reservation_change_requests_block44_resolution_guard
before update of status on public.reservation_change_requests
for each row execute function public.block44_guard_business_proposal_resolution();

revoke all on function public.block44_guard_business_proposal_resolution() from public, anon, authenticated;

create or replace function public.get_admin_reschedule_courts(p_reservation_id uuid)
returns table (
  court_id uuid,
  court_name text,
  booking_increment_minutes smallint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_reservation public.reservations%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner','admin') then
    raise exception 'business_reschedule_proposal_forbidden' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id;

  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;
  if v_reservation.status <> 'confirmed' or v_reservation.start_at <= now() then
    raise exception 'reservation_not_reschedulable' using errcode = '22023';
  end if;
  if v_reservation.user_id is null or not exists (
    select 1 from public.user_accounts ua
    where ua.user_id = v_reservation.user_id and ua.is_active
  ) then
    raise exception 'reservation_customer_account_required' using errcode = '22023';
  end if;

  return query
  select target.id, target.name, v_actor.booking_increment_minutes
  from public.courts target
  join public.courts current on current.id = v_reservation.court_id
  where target.business_id = v_actor.business_id
    and target.is_active
    and target.sport_id = current.sport_id
  order by target.name, target.id;
end;
$$;

create or replace function public.admin_propose_reservation_reschedule(
  p_reservation_id uuid,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_note text default null
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
  v_actor record;
  v_note text := nullif(regexp_replace(trim(coalesce(p_note, '')), '\s+', ' ', 'g'), '');
  v_reservation public.reservations%rowtype;
  v_target_court public.courts%rowtype;
  v_window record;
  v_rate public.pricing_rules%rowtype;
  v_lighting public.lighting_mode;
  v_total numeric;
  v_request public.reservation_change_requests%rowtype;
  v_payment public.reservation_payments%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner','admin') then
    raise exception 'business_reschedule_proposal_forbidden' using errcode = '42501';
  end if;
  if p_reservation_id is null or p_court_id is null or p_date is null or p_start_time is null or p_end_time is null then
    raise exception 'invalid_reschedule_input' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'proposal_note_too_long' using errcode = '22023';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id
  for update;

  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;
  if v_reservation.status <> 'confirmed' then raise exception 'reservation_not_reschedulable' using errcode = '22023'; end if;
  if v_reservation.start_at <= now() then raise exception 'reservation_change_window_closed' using errcode = '22023'; end if;
  if v_reservation.user_id is null or not exists (
    select 1 from public.user_accounts ua
    where ua.user_id = v_reservation.user_id and ua.is_active
  ) then
    raise exception 'reservation_customer_account_required' using errcode = '22023';
  end if;

  -- Lock order B43/B44: reservation first, then pending change request.
  select q.* into v_request
  from public.reservation_change_requests q
  where q.reservation_id = v_reservation.id
    and q.business_id = v_actor.business_id
    and q.status = 'pending'
  order by q.created_at desc
  limit 1
  for update;

  if found then
    if v_request.initiator_kind = 'business'
       and v_request.request_type = 'reschedule'
       and v_request.requested_court_id = p_court_id
       and (v_request.requested_start_at at time zone v_actor.timezone)::date = p_date
       and (v_request.requested_start_at at time zone v_actor.timezone)::time = p_start_time
       and (v_request.requested_end_at at time zone v_actor.timezone)::date = p_date
       and (v_request.requested_end_at at time zone v_actor.timezone)::time = p_end_time then
      return query
      select v_request.id, v_request.status, v_request.requested_start_at,
             v_request.requested_end_at, v_request.requested_total_amount;
      return;
    end if;
    raise exception 'reservation_change_request_already_pending' using errcode = '23505';
  end if;

  select target.* into v_target_court
  from public.courts target
  join public.courts current on current.id = v_reservation.court_id
  where target.id = p_court_id
    and target.business_id = v_actor.business_id
    and target.is_active
    and target.sport_id = current.sport_id;
  if not found then raise exception 'reschedule_court_not_eligible' using errcode = 'P0002'; end if;

  select * into v_window
  from public.phase6_resolve_window(v_actor.business_id, p_court_id, p_date, p_start_time, p_end_time);

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
    where e.business_id = v_actor.business_id
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
  if found and (v_payment.amount <> v_total or v_payment.currency <> v_actor.currency) then
    raise exception 'reservation_payment_requires_business_reschedule' using errcode = '22023';
  end if;

  insert into public.reservation_change_requests (
    reservation_id, business_id, user_id, request_type, status,
    requested_court_id, requested_start_at, requested_end_at, requested_lighting,
    requested_hourly_rate, requested_total_amount,
    initiator_kind, initiated_by, proposal_note
  ) values (
    v_reservation.id, v_reservation.business_id, v_reservation.user_id, 'reschedule', 'pending',
    p_court_id, v_window.start_at, v_window.end_at, v_lighting,
    v_rate.hourly_rate, v_total,
    'business', v_actor.user_id, v_note
  )
  returning * into v_request;

  return query
  select v_request.id, v_request.status, v_request.requested_start_at,
         v_request.requested_end_at, v_request.requested_total_amount;
end;
$$;

-- B40 resolver preserved for customer-origin requests, but B44 makes the
-- direction explicit: a proposal initiated by the business can never be
-- resolved by this administrative RPC, even when the same auth user also owns
-- the customer account. Only respond_to_business_reschedule_proposal() may
-- resolve that row.
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

  if v_request.initiator_kind = 'business' then
    raise exception 'business_reschedule_requires_customer_response' using errcode = '42501';
  end if;

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

create or replace function public.respond_to_business_reschedule_proposal(
  p_request_id uuid,
  p_accept boolean
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
  v_uid uuid := auth.uid();
  v_request public.reservation_change_requests%rowtype;
  v_reservation public.reservations%rowtype;
  v_target_court public.courts%rowtype;
  v_window record;
  v_rate public.pricing_rules%rowtype;
  v_lighting public.lighting_mode;
  v_total numeric;
  v_payment public.reservation_payments%rowtype;
  v_reservation_id uuid;
  v_timezone text;
  v_currency text;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'change_request_id_required' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.user_accounts ua where ua.user_id = v_uid and ua.is_active
  ) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  -- Lookup only to obtain reservation_id. The lock itself is acquired below
  -- after the reservation lock, matching B40-B43 ordering.
  select q.reservation_id into v_reservation_id
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.user_id = v_uid
    and q.request_type = 'reschedule'
    and q.initiator_kind = 'business';
  if not found then raise exception 'change_request_not_found' using errcode = 'P0002'; end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = v_reservation_id
    and r.user_id = v_uid
  for update;
  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.reservation_id = v_reservation.id
    and q.business_id = v_reservation.business_id
    and q.user_id = v_uid
    and q.request_type = 'reschedule'
    and q.initiator_kind = 'business'
  for update;
  if not found then raise exception 'change_request_not_found' using errcode = 'P0002'; end if;

  if v_request.status <> 'pending' then
    if (p_accept and v_request.status = 'approved') or ((not p_accept) and v_request.status = 'rejected') then
      return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
      return;
    end if;
    raise exception 'change_request_already_resolved' using errcode = '22023';
  end if;

  if not p_accept then
    update public.reservation_change_requests q
    set status = 'rejected',
        resolved_by = v_uid,
        resolved_at = now(),
        updated_at = now()
    where q.id = v_request.id
    returning * into v_request;

    return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
    return;
  end if;

  -- Rechazar siempre debe poder cerrar una propuesta pendiente, incluso si el
  -- horario original ya pasó. Solo aceptar exige que la reserva siga siendo
  -- confirmed y futura porque esa rama sí muta la reserva.
  if v_reservation.status <> 'confirmed' or v_reservation.start_at <= now() then
    raise exception 'reservation_change_no_longer_applicable' using errcode = '22023';
  end if;

  if v_request.requested_court_id is null
     or v_request.requested_start_at is null
     or v_request.requested_end_at is null then
    raise exception 'invalid_reschedule_request' using errcode = '22023';
  end if;

  select b.timezone, b.currency into v_timezone, v_currency
  from public.businesses b
  where b.id = v_reservation.business_id;
  if not found then raise exception 'business_not_found' using errcode = 'P0002'; end if;

  select target.* into v_target_court
  from public.courts target
  join public.courts current on current.id = v_reservation.court_id
  where target.id = v_request.requested_court_id
    and target.business_id = v_reservation.business_id
    and target.is_active
    and target.sport_id = current.sport_id;
  if not found then raise exception 'reschedule_court_not_eligible' using errcode = 'P0002'; end if;

  v_local_start := v_request.requested_start_at at time zone v_timezone;
  v_local_end := v_request.requested_end_at at time zone v_timezone;
  if v_local_start::date <> v_local_end::date then
    raise exception 'invalid_interval' using errcode = '22023';
  end if;

  select * into v_window
  from public.phase6_resolve_window(
    v_reservation.business_id,
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

  if exists (
    select 1
    from public.court_schedule_entries e
    where e.business_id = v_reservation.business_id
      and e.court_id = v_request.requested_court_id
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

  begin
    update public.reservations r
    set court_id = v_request.requested_court_id,
        start_at = v_window.start_at,
        end_at = v_window.end_at,
        lighting = v_lighting,
        hourly_rate = v_rate.hourly_rate,
        total_amount = v_total,
        last_modified_by = v_uid
    where r.id = v_reservation.id
    returning r.* into v_reservation;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;

  update public.reservation_change_requests q
  set status = 'approved',
      requested_lighting = v_lighting,
      requested_hourly_rate = v_rate.hourly_rate,
      requested_total_amount = v_total,
      resolved_by = v_uid,
      resolved_at = now(),
      updated_at = now()
  where q.id = v_request.id
  returning * into v_request;

  return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
end;
$$;

-- Listas B40 extendidas con origen de la solicitud/propuesta.
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
  requested_total_amount numeric,
  requested_court_name text,
  initiator_kind text,
  proposal_note text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.reservation_id, q.request_type, q.status, q.customer_reason,
         q.resolution_note, q.created_at, q.resolved_at,
         q.requested_court_id, q.requested_start_at, q.requested_end_at, q.requested_total_amount,
         requested.name, q.initiator_kind, q.proposal_note
  from public.reservation_change_requests q
  left join public.courts requested on requested.id = q.requested_court_id and requested.business_id = q.business_id
  where q.user_id = (select auth.uid())
    and exists (
      select 1 from public.user_accounts ua
      where ua.user_id = (select auth.uid()) and ua.is_active
    )
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
  requested_total_amount numeric,
  initiator_kind text,
  proposal_note text
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
         q.requested_total_amount, q.initiator_kind, q.proposal_note
  from public.reservation_change_requests q
  join public.reservations r on r.id = q.reservation_id and r.business_id = q.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.courts requested on requested.id = q.requested_court_id and requested.business_id = q.business_id
  left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
  where q.business_id = v_actor.business_id
  order by case when q.status = 'pending' then 0 else 1 end, q.created_at desc;
end;
$$;

-- B41 · nuevos eventos semánticos para propuestas del negocio.
alter table public.app_notifications
  drop constraint if exists app_notifications_event_type_check;
alter table public.app_notifications
  add constraint app_notifications_event_type_check
  check (event_type in (
    'reservation_requested',
    'reservation_confirmed',
    'cancellation_requested',
    'cancellation_approved',
    'cancellation_rejected',
    'reschedule_requested',
    'reschedule_approved',
    'reschedule_rejected',
    'reschedule_proposed',
    'reschedule_proposal_accepted',
    'reschedule_proposal_rejected'
  ));

-- Reemplaza el segundo CHECK B41 con uno nombrado explícitamente.
do $$
declare
  v_constraint text;
begin
  select c.conname into v_constraint
  from pg_constraint c
  where c.conrelid = 'public.app_notifications'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%change_request_id%'
    and pg_get_constraintdef(c.oid) like '%reservation_requested%'
  order by c.conname
  limit 1;
  if v_constraint is not null then
    execute format('alter table public.app_notifications drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.app_notifications
  drop constraint if exists app_notifications_source_event_check;
alter table public.app_notifications
  add constraint app_notifications_source_event_check
  check (
    (change_request_id is null and event_type in ('reservation_requested','reservation_confirmed'))
    or
    (change_request_id is not null and event_type in (
      'cancellation_requested','cancellation_approved','cancellation_rejected',
      'reschedule_requested','reschedule_approved','reschedule_rejected',
      'reschedule_proposed','reschedule_proposal_accepted','reschedule_proposal_rejected'
    ))
  );

create or replace function public.block41_queue_change_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requested_event text;
  v_resolved_event text;
begin
  if tg_op = 'INSERT' then
    v_requested_event := case
      when new.request_type = 'reschedule' and new.initiator_kind = 'business' then 'reschedule_proposed'
      when new.request_type = 'cancellation' then 'cancellation_requested'
      when new.request_type = 'reschedule' then 'reschedule_requested'
      else null
    end;

    if v_requested_event is not null and new.user_id is not null then
      insert into public.app_notifications (
        business_id, reservation_id, change_request_id, audience,
        recipient_user_id, event_type, created_at
      ) values (
        new.business_id, new.reservation_id, new.id, 'customer',
        new.user_id, v_requested_event, new.created_at
      )
      on conflict do nothing;
    end if;

    if v_requested_event is not null and new.initiator_kind = 'customer' then
      insert into public.app_notifications (
        business_id, reservation_id, change_request_id, audience,
        recipient_user_id, event_type, created_at
      ) values (
        new.business_id, new.reservation_id, new.id, 'admin',
        null, v_requested_event, new.created_at
      )
      on conflict do nothing;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status in ('approved','rejected') then
    if new.initiator_kind = 'business' and new.request_type = 'reschedule' then
      v_resolved_event := case new.status
        when 'approved' then 'reschedule_proposal_accepted'
        when 'rejected' then 'reschedule_proposal_rejected'
        else null
      end;
      if v_resolved_event is not null then
        insert into public.app_notifications (
          business_id, reservation_id, change_request_id, audience,
          recipient_user_id, event_type, created_at
        ) values (
          new.business_id, new.reservation_id, new.id, 'admin',
          null, v_resolved_event, coalesce(new.resolved_at, now())
        )
        on conflict do nothing;
      end if;
    elsif new.user_id is not null then
      v_resolved_event := case
        when new.request_type = 'cancellation' and new.status = 'approved' then 'cancellation_approved'
        when new.request_type = 'cancellation' and new.status = 'rejected' then 'cancellation_rejected'
        when new.request_type = 'reschedule' and new.status = 'approved' then 'reschedule_approved'
        when new.request_type = 'reschedule' and new.status = 'rejected' then 'reschedule_rejected'
        else null
      end;
      if v_resolved_event is not null then
        insert into public.app_notifications (
          business_id, reservation_id, change_request_id, audience,
          recipient_user_id, event_type, created_at
        ) values (
          new.business_id, new.reservation_id, new.id, 'customer',
          new.user_id, v_resolved_event, coalesce(new.resolved_at, now())
        )
        on conflict do nothing;
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- B42 · semántica correcta del actor/origen en auditoría.
alter table public.reservation_audit_events
  drop constraint if exists reservation_audit_events_event_type_check;
alter table public.reservation_audit_events
  add constraint reservation_audit_events_event_type_check
  check (event_type in (
    'reservation_created',
    'reservation_confirmed',
    'reservation_cancelled',
    'reservation_completed',
    'reservation_rescheduled',
    'reservation_details_updated',
    'reservation_account_linked',
    'reservation_customer_changed',
    'reservation_archived',
    'reservation_restored',
    'cancellation_requested',
    'cancellation_approved',
    'cancellation_rejected',
    'reschedule_requested',
    'reschedule_approved',
    'reschedule_rejected',
    'reschedule_proposed',
    'reschedule_proposal_accepted',
    'reschedule_proposal_rejected'
  ));

create or replace function public.block42_audit_change_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event text;
  v_actor uuid;
  v_actor_kind text;
  v_current_court_name text;
  v_requested_court_name text;
  v_reservation public.reservations%rowtype;
begin
  if tg_op = 'INSERT' then
    select r.* into v_reservation
    from public.reservations r
    where r.id = new.reservation_id and r.business_id = new.business_id;
    if not found then return new; end if;

    select c.name into v_current_court_name from public.courts c where c.id = v_reservation.court_id;
    if new.requested_court_id is not null then
      select c.name into v_requested_court_name from public.courts c where c.id = new.requested_court_id;
    end if;

    v_event := case
      when new.request_type = 'reschedule' and new.initiator_kind = 'business' then 'reschedule_proposed'
      when new.request_type = 'cancellation' then 'cancellation_requested'
      when new.request_type = 'reschedule' then 'reschedule_requested'
      else null
    end;
    if v_event is null then return new; end if;

    v_actor := coalesce(new.initiated_by, new.user_id);
    v_actor_kind := case
      when new.initiator_kind = 'business' then public.block42_actor_kind(v_actor, new.business_id, new.user_id)
      else 'customer'
    end;

    insert into public.reservation_audit_events (
      business_id, reservation_id, change_request_id, event_type,
      actor_user_id, actor_kind, old_status, new_status,
      old_court_name, new_court_name, old_start_at, new_start_at,
      old_end_at, new_end_at, old_lighting, new_lighting,
      old_net_height_cm, new_net_height_cm, old_hourly_rate, new_hourly_rate,
      old_total_amount, new_total_amount, old_customer_id, new_customer_id,
      old_archived_at, new_archived_at,
      request_type, old_request_status, new_request_status,
      created_at
    ) values (
      new.business_id, new.reservation_id, new.id, v_event,
      v_actor, v_actor_kind, v_reservation.status, v_reservation.status,
      v_current_court_name, coalesce(v_requested_court_name, v_current_court_name),
      v_reservation.start_at, coalesce(new.requested_start_at, v_reservation.start_at),
      v_reservation.end_at, coalesce(new.requested_end_at, v_reservation.end_at),
      v_reservation.lighting, coalesce(new.requested_lighting, v_reservation.lighting),
      v_reservation.net_height_cm, v_reservation.net_height_cm,
      v_reservation.hourly_rate, coalesce(new.requested_hourly_rate, v_reservation.hourly_rate),
      v_reservation.total_amount, coalesce(new.requested_total_amount, v_reservation.total_amount),
      v_reservation.customer_id, v_reservation.customer_id,
      v_reservation.archived_at, v_reservation.archived_at,
      new.request_type, null, new.status,
      new.created_at
    );
    return new;
  end if;

  if old.status is distinct from new.status and new.status in ('approved','rejected') then
    v_event := case
      when new.request_type = 'reschedule' and new.initiator_kind = 'business' and new.status = 'approved' then 'reschedule_proposal_accepted'
      when new.request_type = 'reschedule' and new.initiator_kind = 'business' and new.status = 'rejected' then 'reschedule_proposal_rejected'
      when new.request_type = 'cancellation' and new.status = 'approved' then 'cancellation_approved'
      when new.request_type = 'cancellation' and new.status = 'rejected' then 'cancellation_rejected'
      when new.request_type = 'reschedule' and new.status = 'approved' then 'reschedule_approved'
      when new.request_type = 'reschedule' and new.status = 'rejected' then 'reschedule_rejected'
      else null
    end;
    if v_event is null then return new; end if;
    v_actor := new.resolved_by;
    v_actor_kind := public.block42_actor_kind(v_actor, new.business_id, new.user_id);
    insert into public.reservation_audit_events (
      business_id, reservation_id, change_request_id, event_type,
      actor_user_id, actor_kind, request_type, old_request_status, new_request_status,
      created_at
    ) values (
      new.business_id, new.reservation_id, new.id, v_event,
      v_actor, v_actor_kind, new.request_type, old.status, new.status,
      coalesce(new.resolved_at, now())
    );
  end if;
  return new;
end;
$$;

revoke all on function public.get_admin_reschedule_courts(uuid) from public, anon;
grant execute on function public.get_admin_reschedule_courts(uuid) to authenticated;
revoke all on function public.admin_propose_reservation_reschedule(uuid,uuid,date,time,time,text) from public, anon;
grant execute on function public.admin_propose_reservation_reschedule(uuid,uuid,date,time,time,text) to authenticated;
revoke all on function public.respond_to_business_reschedule_proposal(uuid,boolean) from public, anon;
grant execute on function public.respond_to_business_reschedule_proposal(uuid,boolean) to authenticated;
revoke all on function public.get_my_reservation_change_requests() from public, anon;
grant execute on function public.get_my_reservation_change_requests() to authenticated;
revoke all on function public.get_admin_reservation_change_requests() from public, anon;
grant execute on function public.get_admin_reservation_change_requests() to authenticated;

comment on function public.admin_propose_reservation_reschedule(uuid,uuid,date,time,time,text) is
  'B44 owner/admin: propone una reprogramación al cliente vinculado, con precio y disponibilidad validados sin mover aún la reserva.';
comment on function public.respond_to_business_reschedule_proposal(uuid,boolean) is
  'B44 customer: acepta/rechaza exclusivamente una propuesta de reprogramación iniciada por el negocio; aceptar revalida precio, agenda y aplica el cambio atómicamente.';
