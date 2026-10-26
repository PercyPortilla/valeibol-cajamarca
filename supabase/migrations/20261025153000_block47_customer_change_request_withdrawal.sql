-- Bloque 47 · desistimiento del cliente de sus solicitudes B39/B40 pendientes.
-- Reutiliza el lifecycle existente: status rejected + resolution_kind explícito.

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
        or (
          initiator_kind = 'customer'
          and status = 'rejected'
          and resolution_kind in ('customer_expiration','customer_withdrawal')
        )
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

create or replace function public.withdraw_my_reservation_change_request(
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
  v_uid uuid := auth.uid();
  v_reservation_id uuid;
  v_reservation public.reservations%rowtype;
  v_request public.reservation_change_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'change_request_id_required' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = v_uid
      and ua.is_active
  ) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  -- Lookup sin lock solo para obtener reservation_id; la serialización
  -- autoritativa sigue el orden global reservation -> change_request.
  select q.reservation_id into v_reservation_id
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.user_id = v_uid
    and q.initiator_kind = 'customer';
  if not found then
    raise exception 'customer_change_request_not_found' using errcode = 'P0002';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = v_reservation_id
    and r.user_id = v_uid
  for update;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  select q.* into v_request
  from public.reservation_change_requests q
  where q.id = p_request_id
    and q.reservation_id = v_reservation.id
    and q.business_id = v_reservation.business_id
    and q.user_id = v_uid
    and q.initiator_kind = 'customer'
  for update;
  if not found then
    raise exception 'customer_change_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    if v_request.status = 'rejected'
       and v_request.resolution_kind = 'customer_withdrawal'
       and v_request.resolved_by = v_uid then
      return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
      return;
    end if;
    raise exception 'customer_change_request_already_resolved' using errcode = '22023';
  end if;

  -- Mantiene la separación semántica de B46: si la solicitud ya venció,
  -- no puede convertirse tardíamente en un desistimiento del cliente.
  if v_reservation.status <> 'confirmed'
     or v_reservation.start_at <= now()
     or (
       v_request.request_type = 'reschedule'
       and (v_request.requested_start_at is null or v_request.requested_start_at <= now())
     ) then
    raise exception 'customer_change_request_expired_requires_expiration' using errcode = '22023';
  end if;

  update public.reservation_change_requests q
  set status = 'rejected',
      resolved_by = v_uid,
      resolution_kind = 'customer_withdrawal',
      resolved_at = now(),
      updated_at = now()
  where q.id = v_request.id
  returning q.* into v_request;

  -- El desistimiento jamás altera la reserva original.
  return query select v_request.id, v_request.status, v_reservation.id, v_reservation.status;
end;
$$;

-- Mi cuenta recibe el permiso de retiro ya calculado en PostgreSQL; la UI no
-- decide vigencia con su propio reloj.
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
  proposal_note text,
  resolution_kind text,
  can_withdraw_request boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select q.id, q.reservation_id, q.request_type, q.status, q.customer_reason,
         q.resolution_note, q.created_at, q.resolved_at,
         q.requested_court_id, q.requested_start_at, q.requested_end_at, q.requested_total_amount,
         requested.name, q.initiator_kind, q.proposal_note, q.resolution_kind,
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
  from public.reservation_change_requests q
  join public.reservations r
    on r.id = q.reservation_id
   and r.business_id = q.business_id
   and r.user_id = (select auth.uid())
  left join public.courts requested
    on requested.id = q.requested_court_id
   and requested.business_id = q.business_id
  where q.user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_accounts ua
      where ua.user_id = (select auth.uid())
        and ua.is_active
    )
  order by q.created_at desc;
$$;

-- B41 · el negocio debe enterarse del desistimiento sin presentar un falso rechazo.
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
    'cancellation_expired',
    'cancellation_withdrawn',
    'reschedule_requested',
    'reschedule_approved',
    'reschedule_rejected',
    'reschedule_expired',
    'reschedule_withdrawn',
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
      'cancellation_requested','cancellation_approved','cancellation_rejected','cancellation_expired','cancellation_withdrawn',
      'reschedule_requested','reschedule_approved','reschedule_rejected','reschedule_expired','reschedule_withdrawn',
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
    elsif new.initiator_kind = 'customer'
       and new.resolution_kind = 'customer_withdrawal' then
      v_resolved_event := case new.request_type
        when 'cancellation' then 'cancellation_withdrawn'
        when 'reschedule' then 'reschedule_withdrawn'
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
    elsif new.initiator_kind = 'customer'
       and new.resolution_kind = 'customer_expiration' then
      v_resolved_event := case new.request_type
        when 'cancellation' then 'cancellation_expired'
        when 'reschedule' then 'reschedule_expired'
        else null
      end;
      if v_resolved_event is not null and new.user_id is not null then
        insert into public.app_notifications (
          business_id, reservation_id, change_request_id, audience,
          recipient_user_id, event_type, created_at
        ) values (
          new.business_id, new.reservation_id, new.id, 'customer',
          new.user_id, v_resolved_event, coalesce(new.resolved_at, now())
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

-- B42 · actor customer explícito para el desistimiento.
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
    'cancellation_expired',
    'cancellation_withdrawn',
    'reschedule_requested',
    'reschedule_approved',
    'reschedule_rejected',
    'reschedule_expired',
    'reschedule_withdrawn',
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
      when new.initiator_kind = 'customer' and new.resolution_kind = 'customer_withdrawal' and new.request_type = 'cancellation' then 'cancellation_withdrawn'
      when new.initiator_kind = 'customer' and new.resolution_kind = 'customer_withdrawal' and new.request_type = 'reschedule' then 'reschedule_withdrawn'
      when new.initiator_kind = 'customer' and new.resolution_kind = 'customer_expiration' and new.request_type = 'cancellation' then 'cancellation_expired'
      when new.initiator_kind = 'customer' and new.resolution_kind = 'customer_expiration' and new.request_type = 'reschedule' then 'reschedule_expired'
      when new.request_type = 'cancellation' and new.status = 'approved' then 'cancellation_approved'
      when new.request_type = 'cancellation' and new.status = 'rejected' then 'cancellation_rejected'
      when new.request_type = 'reschedule' and new.status = 'approved' then 'reschedule_approved'
      when new.request_type = 'reschedule' and new.status = 'rejected' then 'reschedule_rejected'
      else null
    end;
    if v_event is null then return new; end if;
    v_actor := new.resolved_by;
    v_actor_kind := case
      when new.resolution_kind = 'customer_withdrawal' then 'customer'
      else public.block42_actor_kind(v_actor, new.business_id, new.user_id)
    end;
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

revoke all on function public.withdraw_my_reservation_change_request(uuid) from public, anon;
grant execute on function public.withdraw_my_reservation_change_request(uuid) to authenticated;
revoke all on function public.get_my_reservation_change_requests() from public, anon;
grant execute on function public.get_my_reservation_change_requests() to authenticated;

comment on function public.withdraw_my_reservation_change_request(uuid) is
  'B47 customer: retira su propia solicitud B39/B40 pending; cierra el request sin modificar la reserva y con idempotencia exacta.';
