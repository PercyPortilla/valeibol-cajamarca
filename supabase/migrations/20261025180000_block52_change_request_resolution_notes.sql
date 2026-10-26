-- Caxas Sport Center · Bloque 52
-- Respuesta trazable del negocio al resolver solicitudes customer-origin.

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

  -- Un retry solo es idempotente si repite exactamente decisión y respuesta.
  -- Una nota distinta no puede recibir un falso ACK después del cierre terminal.
  if v_request.status <> 'pending' then
    if v_request.resolution_kind = 'admin_resolution'
       and (
         (p_approve and v_request.status = 'approved')
         or ((not p_approve) and v_request.status = 'rejected')
       )
       and v_request.resolution_note is not distinct from v_note then
      return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
      return;
    end if;
    raise exception 'change_request_already_resolved' using errcode = '22023';
  end if;

  if v_reservation.status <> 'confirmed'
     or v_reservation.start_at <= now()
     or (
       v_request.request_type = 'reschedule'
       and (v_request.requested_start_at is null or v_request.requested_start_at <= now())
     ) then
    raise exception 'customer_change_request_expired_requires_expiration' using errcode = '22023';
  end if;

  if p_approve and v_request.request_type = 'cancellation' then
    update public.reservations r
    set status = 'cancelled',
        last_modified_by = v_actor.user_id,
        status_changed_at = now()
    where r.id = v_reservation.id
    returning r.* into v_reservation;
  elsif p_approve and v_request.request_type = 'reschedule' then
    if v_request.requested_court_id is null
       or v_request.requested_start_at is null
       or v_request.requested_end_at is null then
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
      resolution_kind = 'admin_resolution',
      resolved_at = now(),
      updated_at = now()
  where q.id = v_request.id
  returning q.* into v_request;

  return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
end;
$$;

revoke all on function public.admin_resolve_reservation_change_request(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.admin_resolve_reservation_change_request(uuid, boolean, text)
  to authenticated;

-- B42 sigue siendo append-only y sin free-text duplicado. La nota se resuelve
-- al leer el evento terminal mediante su change_request_id y el mismo tenant.
drop function if exists public.get_admin_reservation_audit(uuid, integer);

create function public.get_admin_reservation_audit(
  p_reservation_id uuid,
  p_limit integer default 100
)
returns table (
  event_id uuid,
  event_type text,
  actor_kind text,
  actor_label text,
  old_status public.reservation_status,
  new_status public.reservation_status,
  old_court_name text,
  new_court_name text,
  old_start_at timestamptz,
  new_start_at timestamptz,
  old_end_at timestamptz,
  new_end_at timestamptz,
  old_lighting public.lighting_mode,
  new_lighting public.lighting_mode,
  old_net_height_cm smallint,
  new_net_height_cm smallint,
  old_hourly_rate numeric,
  new_hourly_rate numeric,
  old_total_amount numeric,
  new_total_amount numeric,
  request_type text,
  old_request_status text,
  new_request_status text,
  change_request_id uuid,
  resolution_note text,
  operation_id text,
  currency text,
  created_at timestamptz
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
  if not exists (
    select 1 from public.reservations r
    where r.id = p_reservation_id and r.business_id = v_actor.business_id
  ) then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  return query
  select
    e.id,
    e.event_type,
    e.actor_kind,
    case e.actor_kind
      when 'customer' then 'Cliente'
      when 'owner' then 'Propietario'
      when 'admin' then 'Administrador'
      when 'staff' then 'Staff'
      when 'platform_admin' then 'Administrador global'
      else 'Sistema'
    end,
    e.old_status,
    e.new_status,
    e.old_court_name,
    e.new_court_name,
    e.old_start_at,
    e.new_start_at,
    e.old_end_at,
    e.new_end_at,
    e.old_lighting,
    e.new_lighting,
    e.old_net_height_cm,
    e.new_net_height_cm,
    e.old_hourly_rate,
    e.new_hourly_rate,
    e.old_total_amount,
    e.new_total_amount,
    e.request_type,
    e.old_request_status,
    e.new_request_status,
    e.change_request_id,
    case
      when e.new_request_status in ('approved','rejected') then q.resolution_note
      else null
    end,
    e.transaction_id,
    v_actor.currency,
    e.created_at
  from public.reservation_audit_events e
  left join public.reservation_change_requests q
    on q.id = e.change_request_id
   and q.business_id = e.business_id
   and q.reservation_id = e.reservation_id
  where e.reservation_id = p_reservation_id
    and e.business_id = v_actor.business_id
  order by e.created_at desc, e.event_sequence desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.get_admin_reservation_audit(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_admin_reservation_audit(uuid, integer)
  to authenticated;

comment on function public.admin_resolve_reservation_change_request(uuid, boolean, text) is
  'B52: resolución customer-origin con respuesta opcional; retry exacto exige misma decisión y misma resolution_note.';
comment on function public.get_admin_reservation_audit(uuid, integer) is
  'B52: historial tenant sanitizado; la nota de resolución se enlaza por change_request_id solo en eventos terminales.';
