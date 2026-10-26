-- Bloque 49 · expiración semántica de solicitudes originales PENDING vencidas.
-- Mantiene reservation_status intacto y clasifica el cierre mediante closure_kind.

alter table public.reservations
  drop constraint if exists reservations_closure_kind_check;
alter table public.reservations
  add constraint reservations_closure_kind_check
  check (
    closure_kind is null
    or (
      status = 'cancelled'
      and closure_kind in (
        'customer_withdrawal',
        'business_rejection',
        'confirmed_cancellation',
        'request_expiration'
      )
    )
  );

-- Una solicitud vencida ya no debe cerrarse como rechazo humano.
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
  if v_reservation.start_at <= now() then
    raise exception 'pending_reservation_expired_requires_expiration' using errcode = '22023';
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

create or replace function public.admin_expire_pending_reservation(p_reservation_id uuid)
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
     and v_reservation.closure_kind = 'request_expiration' then
    return query select v_reservation.id, v_reservation.status, v_reservation.closure_kind, v_reservation.updated_at;
    return;
  end if;

  if v_reservation.status <> 'pending' then
    raise exception 'pending_reservation_already_resolved' using errcode = '22023';
  end if;
  if v_reservation.source <> 'public_web' then
    raise exception 'pending_reservation_not_expirable' using errcode = '22023';
  end if;
  if v_reservation.start_at > now() then
    raise exception 'pending_reservation_not_expired' using errcode = '22023';
  end if;

  update public.reservations
  set status = 'cancelled',
      closure_kind = 'request_expiration',
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.closure_kind, v_reservation.updated_at;
end;
$$;

-- B40/B15 endurecido: la app usa la firma con p_net_height_cm. El overload
-- legacy con p_lighting fue recreado por B40 pero ya no debe quedar expuesto.
drop function if exists public.admin_edit_reservation(
  uuid, uuid, date, time, time, public.lighting_mode, text, text
);

create or replace function public.admin_edit_reservation(
  p_reservation_id uuid,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_net_height_cm smallint,
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
  net_height_cm smallint,
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
  v_lighting public.lighting_mode;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then raise exception 'admin_profile_required' using errcode = '42501'; end if;
  if v_actor.role = 'staff' then raise exception 'insufficient_role' using errcode = '42501'; end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id
  for update;
  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;
  if v_reservation.status = 'confirmed' then
    raise exception 'confirmed_reschedule_requires_request' using errcode = '22023';
  end if;
  if v_reservation.status <> 'pending' then
    raise exception 'reservation_not_editable' using errcode = '22023';
  end if;
  if v_reservation.start_at <= now() then
    raise exception 'pending_reservation_expired_requires_expiration' using errcode = '22023';
  end if;
  if p_net_height_cm is null or p_net_height_cm not between 180 and 250 then
    raise exception 'invalid_net_height' using errcode = '22023';
  end if;

  v_name := regexp_replace(trim(coalesce(p_customer_name, '')), '\s+', ' ', 'g');
  v_phone := trim(coalesce(p_phone_e164, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then raise exception 'invalid_customer_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone_e164' using errcode = '22023'; end if;

  select * into v_window
  from public.phase6_resolve_window(v_actor.business_id, p_court_id, p_date, p_start_time, p_end_time);
  v_lighting := public.resolve_booking_lighting(p_start_time, p_end_time);

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
        lighting = v_lighting,
        net_height_cm = p_net_height_cm,
        hourly_rate = v_rate.hourly_rate,
        total_amount = round(v_rate.hourly_rate * v_window.duration_minutes / 60.0, 2),
        last_modified_by = v_actor.user_id
    where id = v_reservation.id
    returning * into v_reservation;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;

  return query select
    v_reservation.id, v_reservation.status, v_reservation.court_id,
    v_reservation.start_at, v_reservation.end_at, v_reservation.lighting,
    v_reservation.net_height_cm, v_reservation.hourly_rate,
    v_reservation.total_amount, v_actor.currency;
end;
$$;

revoke all on function public.admin_edit_reservation(
  uuid, uuid, date, time, time, smallint, text, text
) from public, anon, authenticated;
grant execute on function public.admin_edit_reservation(
  uuid, uuid, date, time, time, smallint, text, text
) to authenticated;

-- Mi cuenta conoce si una PENDING ya venció incluso antes de que el negocio
-- ejecute la transición terminal.
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
  closure_kind text,
  is_expired_pending boolean
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
    r.closure_kind,
    (r.status = 'pending' and r.source = 'public_web' and r.start_at <= now()) as is_expired_pending
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  join public.sports s on s.id = c.sport_id
  where r.user_id = (select auth.uid())
    and exists (select 1 from public.user_accounts ua where ua.user_id = (select auth.uid()) and ua.is_active)
  order by r.start_at desc, r.created_at desc;
$$;

-- B41 · notificación específica al cliente.
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
    'reservation_expired',
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
      'reservation_cancelled','reservation_withdrawn','reservation_expired'
    ))
    or
    (change_request_id is not null and event_type in (
      'cancellation_requested','cancellation_approved','cancellation_rejected','cancellation_expired','cancellation_withdrawn',
      'reschedule_requested','reschedule_approved','reschedule_rejected','reschedule_expired','reschedule_withdrawn',
      'reschedule_proposed','reschedule_proposal_accepted','reschedule_proposal_rejected',
      'reschedule_proposal_withdrawn','reschedule_proposal_expired'
    ))
  );

create or replace function public.block49_queue_pending_expiration_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'pending'
     and new.status = 'cancelled'
     and new.closure_kind = 'request_expiration'
     and new.user_id is not null then
    insert into public.app_notifications (
      business_id, reservation_id, audience, recipient_user_id, event_type, created_at
    ) values (
      new.business_id,
      new.id,
      'customer',
      new.user_id,
      'reservation_expired',
      coalesce(new.status_changed_at, now())
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_block49_expiration_notification on public.reservations;
create trigger reservations_block49_expiration_notification
after update of status, closure_kind on public.reservations
for each row execute function public.block49_queue_pending_expiration_notification();

revoke all on function public.block49_queue_pending_expiration_notification()
  from public, anon, authenticated;

-- B42 · auditoría de expiración como evento propio, nunca como cancelación.
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
    'reservation_expired',
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
  if new.closure_kind = 'request_expiration' and new.last_modified_by is null then
    v_actor := null;
    v_actor_kind := 'system';
  else
    v_actor := coalesce(new.last_modified_by, new.user_id);
    v_actor_kind := public.block42_actor_kind(v_actor, new.business_id, new.user_id);
  end if;

  if old.status is distinct from new.status then
    v_event := case
      when new.status = 'confirmed' then 'reservation_confirmed'
      when new.status = 'cancelled' and new.closure_kind = 'business_rejection' then 'reservation_rejected'
      when new.status = 'cancelled' and new.closure_kind = 'customer_withdrawal' then 'reservation_withdrawn'
      when new.status = 'cancelled' and new.closure_kind = 'request_expiration' then 'reservation_expired'
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

-- Normaliza las PENDING públicas que ya estaban vencidas al aplicar B49.
-- No toca registros de pago: solo corrige el lifecycle de la reserva.
update public.reservations
set status = 'cancelled',
    closure_kind = 'request_expiration',
    last_modified_by = null,
    status_changed_at = now()
where status = 'pending'
  and source = 'public_web'
  and start_at <= now();

revoke all on function public.admin_expire_pending_reservation(uuid) from public, anon;
grant execute on function public.admin_expire_pending_reservation(uuid) to authenticated;
revoke all on function public.admin_reject_pending_reservation(uuid) from public, anon;
grant execute on function public.admin_reject_pending_reservation(uuid) to authenticated;
revoke all on function public.get_my_reservations() from public, anon;
grant execute on function public.get_my_reservations() to authenticated;

comment on function public.admin_expire_pending_reservation(uuid) is
  'B49: cierra como request_expiration una solicitud public_web PENDING cuyo horario ya comenzó; tenant derivado y FOR UPDATE.';
