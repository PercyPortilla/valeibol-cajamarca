-- Bloque 45 · retiro administrativo de propuestas B44 pendientes.
-- No añade un cuarto status: mantiene pending/approved/rejected y registra
-- el tipo de resolución para distinguir rechazo del cliente vs retiro del negocio.

alter table public.reservation_change_requests
  add column if not exists resolution_kind text;

update public.reservation_change_requests
set resolution_kind = case
  when initiator_kind = 'business' and status in ('approved','rejected') then 'customer_response'
  when initiator_kind = 'customer' and status in ('approved','rejected') then 'admin_resolution'
  else resolution_kind
end
where resolution_kind is null
  and status in ('approved','rejected');

alter table public.reservation_change_requests
  drop constraint if exists reservation_change_requests_resolution_kind_check;
alter table public.reservation_change_requests
  add constraint reservation_change_requests_resolution_kind_check
  check (
    (status = 'pending' and resolution_kind is null)
    or (
      status in ('approved','rejected')
      and (
        (initiator_kind = 'customer' and resolution_kind = 'admin_resolution')
        or (initiator_kind = 'business' and resolution_kind = 'customer_response')
        or (
          initiator_kind = 'business'
          and status = 'rejected'
          and resolution_kind = 'business_withdrawal'
        )
        or (
          initiator_kind = 'business'
          and status = 'rejected'
          and resolution_kind = 'business_expiration'
        )
      )
    )
  );

-- Normaliza resolution_kind y conserva la regla B44: una propuesta del negocio
-- solo la resuelve el cliente, salvo el retiro explícito OWNER/ADMIN de B45.
create or replace function public.block44_guard_business_proposal_resolution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
begin
  if old.status = 'pending' and new.status in ('approved','rejected') then
    if new.resolution_kind is null then
      new.resolution_kind := case
        when old.initiator_kind = 'business' and auth.uid() = old.user_id then 'customer_response'
        when old.initiator_kind = 'customer' then 'admin_resolution'
        else null
      end;
    end if;

    if old.initiator_kind = 'business' then
      if new.resolution_kind in ('business_withdrawal','business_expiration') then
        select * into v_actor from public.phase6_admin_actor();
        if not found
           or v_actor.role not in ('owner','admin')
           or v_actor.business_id <> old.business_id
           or new.status <> 'rejected'
           or new.resolved_by is distinct from v_actor.user_id then
          raise exception 'business_reschedule_withdrawal_forbidden' using errcode = '42501';
        end if;
      elsif new.resolution_kind = 'customer_response' and auth.uid() = old.user_id then
        null;
      else
        raise exception 'business_reschedule_requires_customer_response' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.admin_withdraw_business_reschedule_proposal(
  p_request_id uuid,
  p_note text default null
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
  v_note text := nullif(regexp_replace(trim(coalesce(p_note, '')), '\s+', ' ', 'g'), '');
  v_reservation_id uuid;
  v_reservation public.reservations%rowtype;
  v_request public.reservation_change_requests%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner','admin') then
    raise exception 'business_reschedule_withdrawal_forbidden' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'change_request_id_required' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'withdrawal_note_too_long' using errcode = '22023';
  end if;

  -- Lookup sin lock solo para resolver reservation_id. El orden autoritativo
  -- sigue siendo reservation FOR UPDATE -> change_request FOR UPDATE.
  select q.reservation_id into v_reservation_id
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.business_id = v_actor.business_id
    and q.initiator_kind = 'business'
    and q.request_type = 'reschedule';
  if not found then raise exception 'business_reschedule_proposal_not_found' using errcode = 'P0002'; end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = v_reservation_id
    and r.business_id = v_actor.business_id
  for update;
  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.reservation_id = v_reservation.id
    and q.business_id = v_actor.business_id
    and q.initiator_kind = 'business'
    and q.request_type = 'reschedule'
  for update;
  if not found then raise exception 'business_reschedule_proposal_not_found' using errcode = 'P0002'; end if;

  if v_request.status <> 'pending' then
    if v_request.status = 'rejected' and v_request.resolution_kind = 'business_withdrawal' then
      return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
      return;
    end if;
    raise exception 'business_reschedule_proposal_already_resolved' using errcode = '22023';
  end if;

  -- La UI puede quedar abierta mientras corre el reloj. Si la propuesta ya
  -- venció al momento autoritativo de ejecutar, no debe registrarse como retiro:
  -- debe cerrarse por la ruta de expiración para conservar semántica/auditoría.
  if v_reservation.status <> 'confirmed'
     or v_reservation.start_at <= now()
     or coalesce(v_request.requested_start_at, v_reservation.start_at) <= now() then
    raise exception 'business_reschedule_proposal_expired_requires_expiration' using errcode = '22023';
  end if;

  update public.reservation_change_requests q
  set status = 'rejected',
      resolved_by = v_actor.user_id,
      resolution_note = v_note,
      resolution_kind = 'business_withdrawal',
      resolved_at = now(),
      updated_at = now()
  where q.id = v_request.id
  returning q.* into v_request;

  -- La reserva nunca se modifica al retirar la propuesta.
  return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
end;
$$;

create or replace function public.admin_expire_business_reschedule_proposal(
  p_request_id uuid
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
  v_reservation_id uuid;
  v_reservation public.reservations%rowtype;
  v_request public.reservation_change_requests%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner','admin') then
    raise exception 'business_reschedule_expiration_forbidden' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'change_request_id_required' using errcode = '22023';
  end if;

  select q.reservation_id into v_reservation_id
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.business_id = v_actor.business_id
    and q.initiator_kind = 'business'
    and q.request_type = 'reschedule';
  if not found then raise exception 'business_reschedule_proposal_not_found' using errcode = 'P0002'; end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = v_reservation_id
    and r.business_id = v_actor.business_id
  for update;
  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.reservation_id = v_reservation.id
    and q.business_id = v_actor.business_id
    and q.initiator_kind = 'business'
    and q.request_type = 'reschedule'
  for update;
  if not found then raise exception 'business_reschedule_proposal_not_found' using errcode = 'P0002'; end if;

  if v_request.status <> 'pending' then
    if v_request.status = 'rejected' and v_request.resolution_kind = 'business_expiration' then
      return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
      return;
    end if;
    raise exception 'business_reschedule_proposal_already_resolved' using errcode = '22023';
  end if;

  if v_reservation.status = 'confirmed'
     and v_reservation.start_at > now()
     and coalesce(v_request.requested_start_at, v_reservation.start_at) > now() then
    raise exception 'business_reschedule_proposal_not_expired' using errcode = '22023';
  end if;

  update public.reservation_change_requests q
  set status = 'rejected',
      resolved_by = v_actor.user_id,
      resolution_kind = 'business_expiration',
      resolved_at = now(),
      updated_at = now()
  where q.id = v_request.id
  returning q.* into v_request;

  return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
end;
$$;

-- B41 · notificación semántica al cliente cuando el negocio retira la propuesta.
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
    'reschedule_proposal_rejected',
    'reschedule_proposal_withdrawn',
    'reschedule_proposal_expired'
  ));

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
      'reschedule_proposed','reschedule_proposal_accepted','reschedule_proposal_rejected',
      'reschedule_proposal_withdrawn','reschedule_proposal_expired'
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
    if new.initiator_kind = 'business'
       and new.request_type = 'reschedule'
       and new.resolution_kind in ('business_withdrawal','business_expiration') then
      if new.user_id is not null then
        insert into public.app_notifications (
          business_id, reservation_id, change_request_id, audience,
          recipient_user_id, event_type, created_at
        ) values (
          new.business_id, new.reservation_id, new.id, 'customer',
          new.user_id,
          case new.resolution_kind
            when 'business_expiration' then 'reschedule_proposal_expired'
            else 'reschedule_proposal_withdrawn'
          end,
          coalesce(new.resolved_at, now())
        )
        on conflict do nothing;
      end if;
    elsif new.initiator_kind = 'business' and new.request_type = 'reschedule' then
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

-- B42 · auditoría append-only del retiro, sin alterar snapshot de la reserva.
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
    'reschedule_proposal_rejected',
    'reschedule_proposal_withdrawn',
    'reschedule_proposal_expired'
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
      when new.request_type = 'reschedule' and new.initiator_kind = 'business' and new.resolution_kind = 'business_withdrawal' then 'reschedule_proposal_withdrawn'
      when new.request_type = 'reschedule' and new.initiator_kind = 'business' and new.resolution_kind = 'business_expiration' then 'reschedule_proposal_expired'
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

revoke all on function public.admin_withdraw_business_reschedule_proposal(uuid,text) from public, anon;
grant execute on function public.admin_withdraw_business_reschedule_proposal(uuid,text) to authenticated;
revoke all on function public.admin_expire_business_reschedule_proposal(uuid) from public, anon;
grant execute on function public.admin_expire_business_reschedule_proposal(uuid) to authenticated;

comment on function public.admin_withdraw_business_reschedule_proposal(uuid,text) is
  'B45 OWNER/ADMIN: retira una propuesta B44 pending sin modificar la reserva original; operación idempotente si ya fue retirada.';
comment on function public.admin_expire_business_reschedule_proposal(uuid) is
  'B45 OWNER/ADMIN: expira una propuesta B44 pending solo cuando la reserva o el horario propuesto ya no admiten respuesta temporal.';

-- B45 endurece la idempotencia del responder cliente: un status terminal solo
-- es reintento exitoso si fue producido por customer_response. Un retiro del
-- negocio nunca se presenta al cliente como si él mismo hubiera rechazado.
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
    if v_request.resolution_kind = 'customer_response'
       and (
         (p_accept and v_request.status = 'approved')
         or ((not p_accept) and v_request.status = 'rejected')
       ) then
      return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
      return;
    end if;
    raise exception 'change_request_already_resolved' using errcode = '22023';
  end if;

  if not p_accept then
    update public.reservation_change_requests q
    set status = 'rejected',
        resolved_by = v_uid,
        resolution_kind = 'customer_response',
        resolved_at = now(),
        updated_at = now()
    where q.id = v_request.id
    returning * into v_request;

    return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
    return;
  end if;

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
      resolution_kind = 'customer_response',
      resolved_at = now(),
      updated_at = now()
  where q.id = v_request.id
  returning * into v_request;

  return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
end;
$$;
