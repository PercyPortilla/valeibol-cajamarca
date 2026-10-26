-- Bloque 48 · decisión explícita de solicitudes de reserva originales.
-- Mantiene los cuatro estados históricos y añade una causa de cierre para
-- distinguir retiro del cliente, rechazo del negocio y cancelación posterior.

alter table public.reservations
  add column if not exists closure_kind text;

-- Compatibilidad histórica B30.
-- Antes de B48, un retiro propio dejaba únicamente status=cancelled y
-- last_modified_by=auth.uid(). Clasificamos solo casos con evidencia fuerte:
-- 1) auditoría B42 que ya identifica actor customer, o
-- 2) actor=usuario de la reserva y ese usuario no tenía rol administrativo
--    en el tenant ni era ADMIN global.
-- Los casos ambiguos permanecen NULL en vez de inventar una causa.
update public.reservations r
set closure_kind = 'customer_withdrawal'
where r.closure_kind is null
  and r.status = 'cancelled'
  and r.source = 'public_web'
  and r.user_id is not null
  and r.last_modified_by = r.user_id
  and not exists (
    select 1
    from public.reservation_change_requests q
    where q.reservation_id = r.id
      and q.business_id = r.business_id
      and q.status = 'approved'
  )
  and (
    exists (
      select 1
      from public.reservation_audit_events ae
      where ae.reservation_id = r.id
        and ae.business_id = r.business_id
        and ae.event_type = 'reservation_cancelled'
        and ae.actor_user_id = r.user_id
        and ae.actor_kind = 'customer'
    )
    or (
      not exists (
        select 1
        from public.profiles p
        where p.user_id = r.user_id
          and p.business_id = r.business_id
      )
      and not exists (
        select 1
        from public.user_accounts ua
        where ua.user_id = r.user_id
          and ua.role = 'admin'
      )
    )
  );

-- Cuando B42 ya existía, old_status permite clasificar cierres del negocio
-- sin inferencias: pending -> rechazo; confirmed -> cancelación.
update public.reservations r
set closure_kind = case ae.old_status
  when 'pending' then 'business_rejection'
  when 'confirmed' then 'confirmed_cancellation'
  else r.closure_kind
end
from public.reservation_audit_events ae
where r.closure_kind is null
  and r.status = 'cancelled'
  and ae.reservation_id = r.id
  and ae.business_id = r.business_id
  and ae.event_type = 'reservation_cancelled'
  and ae.new_status = 'cancelled'
  and ae.old_status in ('pending','confirmed')
  and ae.actor_kind in ('owner','admin','staff','platform_admin');

alter table public.reservations
  drop constraint if exists reservations_closure_kind_check;
alter table public.reservations
  add constraint reservations_closure_kind_check
  check (
    closure_kind is null
    or (
      status = 'cancelled'
      and closure_kind in ('customer_withdrawal','business_rejection','confirmed_cancellation')
    )
  );

comment on column public.reservations.closure_kind is
  'B48: semántica terminal de status=cancelled sin añadir un quinto estado: customer_withdrawal, business_rejection o confirmed_cancellation.';

-- B30 endurecido: un retiro del cliente solo es idempotente si el cierre
-- anterior fue exactamente customer_withdrawal.
create or replace function public.withdraw_my_pending_reservation(p_reservation_id uuid)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_reservation public.reservations%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_reservation_id is null then
    raise exception 'reservation_id_required' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = v_uid
      and ua.is_active
  ) then
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

  if v_reservation.status = 'cancelled' then
    if v_reservation.closure_kind = 'customer_withdrawal'
       and v_reservation.last_modified_by = v_uid then
      return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
      return;
    end if;
    raise exception 'reservation_not_withdrawable' using errcode = '22023';
  end if;

  if v_reservation.status <> 'pending'
     or v_reservation.source <> 'public_web' then
    raise exception 'reservation_not_withdrawable' using errcode = '22023';
  end if;
  if v_reservation.start_at <= now() then
    raise exception 'reservation_withdrawal_window_closed' using errcode = '22023';
  end if;

  perform 1
    from public.reservation_payments p
    where p.reservation_id = v_reservation.id
      and p.business_id = v_reservation.business_id
      and p.status in ('reported', 'verified')
    order by p.id
    for update;
  if found then
    raise exception 'reservation_payment_requires_business_cancellation' using errcode = '22023';
  end if;

  update public.reservations r
  set status = 'cancelled',
      closure_kind = 'customer_withdrawal',
      last_modified_by = v_uid,
      status_changed_at = now()
  where r.id = v_reservation.id
  returning r.* into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
end;
$$;

-- No se puede aceptar una solicitud original cuando su horario ya comenzó.
create or replace function public.admin_confirm_reservation(p_reservation_id uuid)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
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

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.status = 'confirmed' then
    return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
    return;
  end if;
  if v_reservation.status <> 'pending' then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;
  if v_reservation.start_at <= now() then
    raise exception 'reservation_confirmation_window_closed' using errcode = '22023';
  end if;

  update public.reservations
  set status = 'confirmed',
      closure_kind = null,
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
end;
$$;

create or replace function public.admin_reject_pending_reservation(p_reservation_id uuid)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  closure_kind text,
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

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.status = 'cancelled'
     and v_reservation.closure_kind = 'business_rejection' then
    return query select v_reservation.id, v_reservation.status, v_reservation.closure_kind, v_reservation.updated_at;
    return;
  end if;

  if v_reservation.status <> 'pending' then
    raise exception 'pending_reservation_already_resolved' using errcode = '22023';
  end if;
  if v_reservation.source <> 'public_web' then
    raise exception 'pending_reservation_not_rejectable' using errcode = '22023';
  end if;

  update public.reservations
  set status = 'cancelled',
      closure_kind = 'business_rejection',
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.closure_kind, v_reservation.updated_at;
end;
$$;

-- Confirmed -> cancelled conserva la semántica de cancelación posterior.
drop function if exists public.admin_cancel_reservation(uuid);
create function public.admin_cancel_reservation(p_reservation_id uuid)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  closure_kind text,
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
  v_pending_change_request_id uuid;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if v_reservation.status = 'cancelled' then
    if v_reservation.closure_kind = 'confirmed_cancellation' then
      return query select v_reservation.id, v_reservation.status, v_reservation.closure_kind, v_reservation.updated_at;
      return;
    end if;
    raise exception 'reservation_already_closed' using errcode = '22023';
  end if;

  if v_reservation.status = 'pending' then
    raise exception 'pending_reservation_requires_rejection' using errcode = '22023';
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  select q.id into v_pending_change_request_id
  from public.reservation_change_requests q
  where q.reservation_id = v_reservation.id
    and q.business_id = v_actor.business_id
    and q.status = 'pending'
  order by q.created_at desc
  limit 1
  for update;

  if found then
    raise exception 'reservation_change_request_pending' using errcode = '22023';
  end if;

  update public.reservations
  set status = 'cancelled',
      closure_kind = 'confirmed_cancellation',
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.closure_kind, v_reservation.updated_at;
end;
$$;

-- Mi cuenta recibe la causa de cierre ya clasificada por servidor.
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
  can_request_reschedule boolean,
  closure_kind text
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
    ) as can_request_reschedule,
    r.closure_kind
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  join public.sports s on s.id = c.sport_id
  where r.user_id = (select auth.uid())
    and exists (select 1 from public.user_accounts ua where ua.user_id = (select auth.uid()) and ua.is_active)
  order by r.start_at desc, r.created_at desc;
$$;

-- B41 · eventos de cierre de reserva original.
alter table public.app_notifications
  drop constraint if exists app_notifications_event_type_check;
alter table public.app_notifications
  add constraint app_notifications_event_type_check
  check (event_type in (
    'reservation_requested',
    'reservation_confirmed',
    'reservation_rejected',
    'reservation_cancelled',
    'reservation_withdrawn',
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
    (change_request_id is null and event_type in (
      'reservation_requested','reservation_confirmed','reservation_rejected',
      'reservation_cancelled','reservation_withdrawn'
    ))
    or
    (change_request_id is not null and event_type in (
      'cancellation_requested','cancellation_approved','cancellation_rejected','cancellation_expired','cancellation_withdrawn',
      'reschedule_requested','reschedule_approved','reschedule_rejected','reschedule_expired','reschedule_withdrawn',
      'reschedule_proposed','reschedule_proposal_accepted','reschedule_proposal_rejected',
      'reschedule_proposal_withdrawn','reschedule_proposal_expired'
    ))
  );

create or replace function public.block41_queue_reservation_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_created_at timestamptz;
begin
  if new.source = 'public_web'
     and new.status = 'pending'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
     ) then
    insert into public.app_notifications (
      business_id, reservation_id, audience, recipient_user_id, event_type, created_at
    ) values (
      new.business_id, new.id, 'admin', null, 'reservation_requested', new.created_at
    )
    on conflict do nothing;
  end if;

  if new.user_id is not null
     and new.status = 'confirmed'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.user_id is distinct from new.user_id
     ) then
    v_customer_created_at := case
      when tg_op = 'UPDATE'
       and old.status = new.status
       and old.user_id is distinct from new.user_id
        then now()
      else coalesce(new.status_changed_at, now())
    end;
    insert into public.app_notifications (
      business_id, reservation_id, audience, recipient_user_id, event_type, created_at
    ) values (
      new.business_id, new.id, 'customer', new.user_id, 'reservation_confirmed', v_customer_created_at
    )
    on conflict do nothing;
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'cancelled' then
    if new.closure_kind = 'business_rejection' and new.user_id is not null then
      insert into public.app_notifications (
        business_id, reservation_id, audience, recipient_user_id, event_type, created_at
      ) values (
        new.business_id, new.id, 'customer', new.user_id, 'reservation_rejected',
        coalesce(new.status_changed_at, now())
      )
      on conflict do nothing;
    elsif new.closure_kind = 'confirmed_cancellation' and new.user_id is not null then
      insert into public.app_notifications (
        business_id, reservation_id, audience, recipient_user_id, event_type, created_at
      ) values (
        new.business_id, new.id, 'customer', new.user_id, 'reservation_cancelled',
        coalesce(new.status_changed_at, now())
      )
      on conflict do nothing;
    elsif new.closure_kind = 'customer_withdrawal' then
      insert into public.app_notifications (
        business_id, reservation_id, audience, recipient_user_id, event_type, created_at
      ) values (
        new.business_id, new.id, 'admin', null, 'reservation_withdrawn',
        coalesce(new.status_changed_at, now())
      )
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- B42 · auditoría semántica de cierres originales.
alter table public.reservation_audit_events
  drop constraint if exists reservation_audit_events_event_type_check;
alter table public.reservation_audit_events
  add constraint reservation_audit_events_event_type_check
  check (event_type in (
    'reservation_created',
    'reservation_confirmed',
    'reservation_cancelled',
    'reservation_rejected',
    'reservation_withdrawn',
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

create or replace function public.block42_audit_reservation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid;
  v_actor_kind text;
  v_old_court_name text;
  v_new_court_name text;
  v_event text;
begin
  select c.name into v_new_court_name from public.courts c where c.id = new.court_id;

  if tg_op = 'INSERT' then
    v_actor := coalesce(new.created_by, new.user_id);
    v_actor_kind := case
      when new.source = 'public_web' then 'customer'
      else public.block42_actor_kind(v_actor, new.business_id, new.user_id)
    end;
    insert into public.reservation_audit_events (
      business_id, reservation_id, event_type, actor_user_id, actor_kind,
      new_status, new_court_name, new_start_at, new_end_at,
      new_lighting, new_net_height_cm, new_hourly_rate, new_total_amount,
      new_customer_id, new_archived_at, created_at
    ) values (
      new.business_id, new.id, 'reservation_created', v_actor, v_actor_kind,
      new.status, v_new_court_name, new.start_at, new.end_at,
      new.lighting, new.net_height_cm, new.hourly_rate, new.total_amount,
      new.customer_id, new.archived_at, new.created_at
    );
    return new;
  end if;

  select c.name into v_old_court_name from public.courts c where c.id = old.court_id;
  v_actor := coalesce(new.last_modified_by, new.user_id);
  v_actor_kind := public.block42_actor_kind(v_actor, new.business_id, new.user_id);

  if old.status is distinct from new.status then
    v_event := case
      when new.status = 'confirmed' then 'reservation_confirmed'
      when new.status = 'cancelled' and new.closure_kind = 'business_rejection' then 'reservation_rejected'
      when new.status = 'cancelled' and new.closure_kind = 'customer_withdrawal' then 'reservation_withdrawn'
      when new.status = 'cancelled' then 'reservation_cancelled'
      when new.status = 'completed' then 'reservation_completed'
      else 'reservation_details_updated'
    end;
    insert into public.reservation_audit_events (
      business_id, reservation_id, event_type, actor_user_id, actor_kind,
      old_status, new_status, old_court_name, new_court_name,
      old_start_at, new_start_at, old_end_at, new_end_at,
      old_lighting, new_lighting, old_net_height_cm, new_net_height_cm,
      old_hourly_rate, new_hourly_rate, old_total_amount, new_total_amount,
      old_customer_id, new_customer_id, old_archived_at, new_archived_at
    ) values (
      new.business_id, new.id, v_event, v_actor, v_actor_kind,
      old.status, new.status, v_old_court_name, v_new_court_name,
      old.start_at, new.start_at, old.end_at, new.end_at,
      old.lighting, new.lighting, old.net_height_cm, new.net_height_cm,
      old.hourly_rate, new.hourly_rate, old.total_amount, new.total_amount,
      old.customer_id, new.customer_id, old.archived_at, new.archived_at
    );
  end if;

  if old.court_id is distinct from new.court_id
     or old.start_at is distinct from new.start_at
     or old.end_at is distinct from new.end_at then
    insert into public.reservation_audit_events (
      business_id, reservation_id, event_type, actor_user_id, actor_kind,
      old_status, new_status, old_court_name, new_court_name,
      old_start_at, new_start_at, old_end_at, new_end_at,
      old_lighting, new_lighting, old_net_height_cm, new_net_height_cm,
      old_hourly_rate, new_hourly_rate, old_total_amount, new_total_amount,
      old_customer_id, new_customer_id, old_archived_at, new_archived_at
    ) values (
      new.business_id, new.id, 'reservation_rescheduled', v_actor, v_actor_kind,
      old.status, new.status, v_old_court_name, v_new_court_name,
      old.start_at, new.start_at, old.end_at, new.end_at,
      old.lighting, new.lighting, old.net_height_cm, new.net_height_cm,
      old.hourly_rate, new.hourly_rate, old.total_amount, new.total_amount,
      old.customer_id, new.customer_id, old.archived_at, new.archived_at
    );
  elsif old.lighting is distinct from new.lighting
     or old.net_height_cm is distinct from new.net_height_cm
     or old.hourly_rate is distinct from new.hourly_rate
     or old.total_amount is distinct from new.total_amount then
    insert into public.reservation_audit_events (
      business_id, reservation_id, event_type, actor_user_id, actor_kind,
      old_status, new_status, old_court_name, new_court_name,
      old_start_at, new_start_at, old_end_at, new_end_at,
      old_lighting, new_lighting, old_net_height_cm, new_net_height_cm,
      old_hourly_rate, new_hourly_rate, old_total_amount, new_total_amount,
      old_customer_id, new_customer_id, old_archived_at, new_archived_at
    ) values (
      new.business_id, new.id, 'reservation_details_updated', v_actor, v_actor_kind,
      old.status, new.status, v_old_court_name, v_new_court_name,
      old.start_at, new.start_at, old.end_at, new.end_at,
      old.lighting, new.lighting, old.net_height_cm, new.net_height_cm,
      old.hourly_rate, new.hourly_rate, old.total_amount, new.total_amount,
      old.customer_id, new.customer_id, old.archived_at, new.archived_at
    );
  end if;

  if old.customer_id is distinct from new.customer_id then
    insert into public.reservation_audit_events (
      business_id, reservation_id, event_type, actor_user_id, actor_kind,
      old_status, new_status, old_court_name, new_court_name,
      old_start_at, new_start_at, old_end_at, new_end_at,
      old_lighting, new_lighting, old_net_height_cm, new_net_height_cm,
      old_hourly_rate, new_hourly_rate, old_total_amount, new_total_amount,
      old_customer_id, new_customer_id, old_archived_at, new_archived_at
    ) values (
      new.business_id, new.id, 'reservation_customer_changed', v_actor, v_actor_kind,
      old.status, new.status, v_old_court_name, v_new_court_name,
      old.start_at, new.start_at, old.end_at, new.end_at,
      old.lighting, new.lighting, old.net_height_cm, new.net_height_cm,
      old.hourly_rate, new.hourly_rate, old.total_amount, new.total_amount,
      old.customer_id, new.customer_id, old.archived_at, new.archived_at
    );
  end if;

  if old.archived_at is distinct from new.archived_at then
    insert into public.reservation_audit_events (
      business_id, reservation_id, event_type, actor_user_id, actor_kind,
      old_status, new_status, old_court_name, new_court_name,
      old_start_at, new_start_at, old_end_at, new_end_at,
      old_lighting, new_lighting, old_net_height_cm, new_net_height_cm,
      old_hourly_rate, new_hourly_rate, old_total_amount, new_total_amount,
      old_customer_id, new_customer_id, old_archived_at, new_archived_at
    ) values (
      new.business_id, new.id,
      case when new.archived_at is null then 'reservation_restored' else 'reservation_archived' end,
      v_actor, v_actor_kind,
      old.status, new.status, v_old_court_name, v_new_court_name,
      old.start_at, new.start_at, old.end_at, new.end_at,
      old.lighting, new.lighting, old.net_height_cm, new.net_height_cm,
      old.hourly_rate, new.hourly_rate, old.total_amount, new.total_amount,
      old.customer_id, new.customer_id, old.archived_at, new.archived_at
    );
  end if;

  if old.user_id is distinct from new.user_id and new.user_id is not null then
    insert into public.reservation_audit_events (
      business_id, reservation_id, event_type, actor_user_id, actor_kind,
      old_status, new_status, old_court_name, new_court_name,
      old_start_at, new_start_at, old_end_at, new_end_at,
      old_lighting, new_lighting, old_net_height_cm, new_net_height_cm,
      old_hourly_rate, new_hourly_rate, old_total_amount, new_total_amount,
      old_customer_id, new_customer_id, old_archived_at, new_archived_at
    ) values (
      new.business_id, new.id, 'reservation_account_linked', new.user_id, 'customer',
      old.status, new.status, v_old_court_name, v_new_court_name,
      old.start_at, new.start_at, old.end_at, new.end_at,
      old.lighting, new.lighting, old.net_height_cm, new.net_height_cm,
      old.hourly_rate, new.hourly_rate, old.total_amount, new.total_amount,
      old.customer_id, new.customer_id, old.archived_at, new.archived_at
    );
  end if;

  return new;
end;
$$;

revoke all on function public.withdraw_my_pending_reservation(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_my_pending_reservation(uuid) to authenticated;
revoke all on function public.admin_confirm_reservation(uuid) from public, anon;
grant execute on function public.admin_confirm_reservation(uuid) to authenticated;
revoke all on function public.admin_reject_pending_reservation(uuid) from public, anon;
grant execute on function public.admin_reject_pending_reservation(uuid) to authenticated;
revoke all on function public.admin_cancel_reservation(uuid) from public, anon;
grant execute on function public.admin_cancel_reservation(uuid) to authenticated;
revoke all on function public.get_my_reservations() from public, anon;
grant execute on function public.get_my_reservations() to authenticated;

comment on function public.admin_cancel_reservation(uuid) is
  'B48: cancela únicamente una reserva confirmed, preservando locks B43 e idempotencia exacta.';
comment on function public.admin_reject_pending_reservation(uuid) is
  'B48: rechaza únicamente una solicitud public_web pending; serializa sobre la reserva y nunca convierte una confirmación concurrente en cancelación.';
comment on function public.admin_confirm_reservation(uuid) is
  'B48: confirma únicamente una solicitud pending cuyo horario aún no comenzó.';
