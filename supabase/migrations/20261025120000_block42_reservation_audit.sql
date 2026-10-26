-- Bloque 42 · historial/auditoría append-only de reservas.
-- Registra cambios operativos sin duplicar PII de clientes.

create table if not exists public.reservation_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_sequence bigint generated always as identity unique,
  transaction_id text not null default pg_current_xact_id()::text,
  business_id uuid not null references public.businesses(id) on delete cascade,
  reservation_id uuid not null,
  change_request_id uuid,
  event_type text not null check (event_type in (
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
    'reschedule_rejected'
  )),
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('customer','owner','admin','staff','platform_admin','system')),
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
  old_customer_id uuid,
  new_customer_id uuid,
  old_archived_at timestamptz,
  new_archived_at timestamptz,
  request_type text check (request_type is null or request_type in ('cancellation','reschedule')),
  old_request_status text check (old_request_status is null or old_request_status in ('pending','approved','rejected')),
  new_request_status text check (new_request_status is null or new_request_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  foreign key (reservation_id, business_id)
    references public.reservations(id, business_id) on delete cascade,
  foreign key (change_request_id, business_id)
    references public.reservation_change_requests(id, business_id) on delete cascade
);

create index if not exists reservation_audit_events_reservation_created_idx
  on public.reservation_audit_events (reservation_id, created_at desc, id desc);
create index if not exists reservation_audit_events_business_created_idx
  on public.reservation_audit_events (business_id, created_at desc);

alter table public.reservation_audit_events enable row level security;
revoke all on public.reservation_audit_events from public, anon, authenticated;

create or replace function public.block42_reject_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from public.businesses b where b.id = old.business_id
  ) then
    -- Excepción de lifecycle: permite la cascada cuando se elimina el tenant completo.
    return old;
  end if;
  raise exception 'reservation_audit_is_append_only' using errcode = '42501';
end;
$$;

drop trigger if exists reservation_audit_events_append_only on public.reservation_audit_events;
create trigger reservation_audit_events_append_only
before update or delete on public.reservation_audit_events
for each row execute function public.block42_reject_audit_mutation();

create or replace function public.block42_actor_kind(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_customer_user_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.app_role;
begin
  if p_actor_user_id is null then return 'system'; end if;
  if exists (
    select 1 from public.user_accounts ua
    where ua.user_id = p_actor_user_id and ua.role = 'admin'
  ) then
    return 'platform_admin';
  end if;
  select p.role into v_role
  from public.profiles p
  where p.user_id = p_actor_user_id and p.business_id = p_business_id
  limit 1;
  if found then return v_role::text; end if;
  if p_customer_user_id is not null and p_actor_user_id = p_customer_user_id then return 'customer'; end if;
  if exists (select 1 from public.user_accounts ua where ua.user_id = p_actor_user_id) then return 'customer'; end if;
  return 'system';
end;
$$;

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
    v_event := case new.status
      when 'confirmed' then 'reservation_confirmed'
      when 'cancelled' then 'reservation_cancelled'
      when 'completed' then 'reservation_completed'
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

drop trigger if exists reservations_block42_audit on public.reservations;
create trigger reservations_block42_audit
after insert or update of status, court_id, start_at, end_at, lighting,
  net_height_cm, hourly_rate, total_amount, user_id, customer_id, archived_at
on public.reservations
for each row execute function public.block42_audit_reservation();

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

    v_event := case new.request_type
      when 'cancellation' then 'cancellation_requested'
      when 'reschedule' then 'reschedule_requested'
      else null
    end;
    if v_event is null then return new; end if;
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
      new.user_id, 'customer', v_reservation.status, v_reservation.status,
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
      when new.request_type = 'cancellation' and new.status = 'approved' then 'cancellation_approved'
      when new.request_type = 'cancellation' and new.status = 'rejected' then 'cancellation_rejected'
      when new.request_type = 'reschedule' and new.status = 'approved' then 'reschedule_approved'
      when new.request_type = 'reschedule' and new.status = 'rejected' then 'reschedule_rejected'
      else null
    end;
    if v_event is null then return new; end if;
    v_actor := new.resolved_by;
    v_actor_kind := public.block42_actor_kind(v_actor, new.business_id, null);
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

drop trigger if exists reservation_change_requests_block42_audit on public.reservation_change_requests;
create trigger reservation_change_requests_block42_audit
after insert or update of status on public.reservation_change_requests
for each row execute function public.block42_audit_change_request();

revoke all on function public.block42_actor_kind(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.block42_audit_reservation() from public, anon, authenticated;
revoke all on function public.block42_audit_change_request() from public, anon, authenticated;
revoke all on function public.block42_reject_audit_mutation() from public, anon, authenticated;

create or replace function public.get_admin_reservation_audit(
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
    e.transaction_id,
    v_actor.currency,
    e.created_at
  from public.reservation_audit_events e
  where e.reservation_id = p_reservation_id
    and e.business_id = v_actor.business_id
  order by e.created_at desc, e.event_sequence desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
end;
$$;

revoke all on function public.get_admin_reservation_audit(uuid,integer) from public, anon;
grant execute on function public.get_admin_reservation_audit(uuid,integer) to authenticated;

comment on table public.reservation_audit_events is
  'B42: historial append-only de cambios operativos y change requests; no duplica nombre, teléfono, email ni motivo libre del cliente.';
comment on function public.get_admin_reservation_audit(uuid,integer) is
  'B42: historial sanitizado de una reserva del tenant activo; actor expuesto solo como categoría, nunca email/PII.';

