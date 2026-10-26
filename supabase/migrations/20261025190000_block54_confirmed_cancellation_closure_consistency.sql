-- Caxas Sport Center · Bloque 54
-- Una cancelación aprobada desde una solicitud customer-origin también debe
-- cerrar la reserva como confirmed_cancellation, igual que la cancelación
-- administrativa directa de B48.

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
    if v_request.resolution_kind = 'admin_resolution'
       and (
         (p_approve and v_request.status = 'approved')
         or ((not p_approve) and v_request.status = 'rejected')
       )
       and v_request.resolution_note is not distinct from v_note
       and (
         not (p_approve and v_request.request_type = 'cancellation')
         or (
           v_reservation.status = 'cancelled'
           and v_reservation.closure_kind = 'confirmed_cancellation'
         )
       ) then
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

    -- Segundo UPDATE dentro de la misma transacción: B41/B42 escuchan el
    -- cambio de status, no closure_kind. Así la aprobación conserva su
    -- notification específica cancellation_approved sin añadir además la
    -- notificación genérica reservation_cancelled.
    update public.reservations r
    set closure_kind = 'confirmed_cancellation'
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

-- Backfill conservador: solo casos con evidencia inequívoca de aprobación
-- administrativa de una solicitud de cancelación del propio cliente.
update public.reservations r
set closure_kind = 'confirmed_cancellation'
where r.status = 'cancelled'
  and r.closure_kind is null
  and exists (
    select 1
    from public.reservation_change_requests q
    where q.reservation_id = r.id
      and q.business_id = r.business_id
      and q.user_id = r.user_id
      and q.initiator_kind = 'customer'
      and q.request_type = 'cancellation'
      and q.status = 'approved'
      and q.resolution_kind = 'admin_resolution'
  );

comment on function public.admin_resolve_reservation_change_request(uuid, boolean, text) is
  'B54: aprobación de cancelación customer-origin clasifica la reserva como confirmed_cancellation en un segundo UPDATE transaccional y conserva idempotencia exacta de B52.';
