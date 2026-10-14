-- Valeibol · Fase 6
-- Operación administrativa real y pizarra semanal segura.
-- Mantiene DML directo revocado: toda mutación pasa por RPCs específicas SECURITY DEFINER.
-- El negocio/rol se deriva siempre de auth.uid(); nunca se acepta business_id, precio, total o estado desde el cliente.

alter table public.reservations
  add column if not exists last_modified_by uuid references auth.users(id) on delete set null,
  add column if not exists status_changed_at timestamptz;

alter table public.schedule_blocks
  add column if not exists last_modified_by uuid references auth.users(id) on delete set null,
  add column if not exists status_changed_at timestamptz;

comment on column public.reservations.last_modified_by is
  'Fase 6: último usuario administrativo que modificó la reserva mediante una RPC operativa.';
comment on column public.reservations.status_changed_at is
  'Fase 6: instante del último cambio explícito de estado administrativo.';
comment on column public.schedule_blocks.last_modified_by is
  'Fase 6: último usuario administrativo que modificó el bloqueo mediante una RPC operativa.';
comment on column public.schedule_blocks.status_changed_at is
  'Fase 6: instante del último cambio explícito de estado del bloqueo.';


-- Señal pública sanitizada para refresco Realtime. No contiene horarios, clientes, estados ni PII.
create table if not exists public.availability_revisions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.availability_revisions enable row level security;

drop policy if exists availability_revisions_public_read on public.availability_revisions;
create policy availability_revisions_public_read
on public.availability_revisions
for select
to anon, authenticated
using (true);

revoke all on public.availability_revisions from public, anon, authenticated;
grant select on public.availability_revisions to anon, authenticated;

create or replace function public.touch_availability_revision()
returns trigger
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
begin
  v_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;

  insert into public.availability_revisions (business_id, revision, updated_at)
  values (v_business_id, 1, now())
  on conflict (business_id) do update
    set revision = public.availability_revisions.revision + 1,
        updated_at = now();

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists court_schedule_entries_touch_public_revision on public.court_schedule_entries;
create trigger court_schedule_entries_touch_public_revision
after insert or update or delete on public.court_schedule_entries
for each row execute function public.touch_availability_revision();

revoke all on function public.touch_availability_revision() from public, anon, authenticated;

-- Supabase Realtime: publicar únicamente la señal sanitizada. Si la publicación no existe
-- (por ejemplo, PostgreSQL fuera de Supabase), la migración continúa y queda el polling fallback.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'availability_revisions'
     ) then
    execute 'alter publication supabase_realtime add table public.availability_revisions';
  end if;
end;
$$;

comment on table public.availability_revisions is
  'Fase 6: señal Realtime pública sin PII para pedir una nueva lectura de la RPC sanitizada de disponibilidad.';

-- Contexto interno de operación. No se concede EXECUTE a roles de aplicación.
create or replace function public.phase6_admin_actor()
returns table (
  user_id uuid,
  business_id uuid,
  role public.app_role,
  timezone text,
  currency text,
  booking_increment_minutes smallint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.user_id,
    p.business_id,
    p.role,
    b.timezone,
    b.currency,
    b.booking_increment_minutes
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where p.user_id = auth.uid()
    and p.is_active
    and b.is_active
    and p.role in ('owner', 'admin', 'staff')
  limit 1;
$$;

-- Resuelve y valida un intervalo local del negocio. La salida ya está normalizada a timestamptz.
create or replace function public.phase6_resolve_window(
  p_business_id uuid,
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
returns table (
  court_name text,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes numeric,
  schedule_status public.configuration_status
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_court public.courts%rowtype;
  v_hours public.operating_hours%rowtype;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_duration_minutes numeric;
  v_start_offset_minutes numeric;
begin
  if p_date is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then
    raise exception 'invalid_interval' using errcode = '22023';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = p_business_id and b.is_active
  for share;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  select c.* into v_court
  from public.courts c
  where c.id = p_court_id
    and c.business_id = v_business.id
    and c.is_active
  for share;

  if not found then
    raise exception 'court_not_found' using errcode = 'P0002';
  end if;

  select oh.* into v_hours
  from public.operating_hours oh
  where oh.court_id = v_court.id
    and oh.weekday = extract(isodow from p_date)::smallint
    and p_date >= oh.effective_from
    and (oh.effective_until is null or p_date <= oh.effective_until)
  order by oh.effective_from desc
  limit 1;

  if not found or not v_hours.is_open or v_hours.opens_at is null or v_hours.closes_at is null then
    raise exception 'court_closed' using errcode = '22023';
  end if;

  if p_start_time < v_hours.opens_at or p_end_time > v_hours.closes_at then
    raise exception 'outside_operating_hours' using errcode = '22023';
  end if;

  v_duration_minutes := extract(epoch from (p_end_time - p_start_time)) / 60.0;
  v_start_offset_minutes := extract(epoch from (p_start_time - v_hours.opens_at)) / 60.0;

  if v_duration_minutes <= 0
     or mod(v_duration_minutes::numeric, v_business.booking_increment_minutes::numeric) <> 0
     or mod(v_start_offset_minutes::numeric, v_business.booking_increment_minutes::numeric) <> 0 then
    raise exception 'invalid_booking_increment' using errcode = '22023';
  end if;

  v_start_at := (p_date + p_start_time) at time zone v_business.timezone;
  v_end_at := (p_date + p_end_time) at time zone v_business.timezone;

  if v_start_at <= now() then
    raise exception 'schedule_in_past' using errcode = '22023';
  end if;

  return query select
    v_court.name,
    v_start_at,
    v_end_at,
    v_duration_minutes,
    v_hours.configuration_status;
end;
$$;

-- Pizarra administrativa. Incluye PII mínima solo porque la función exige perfil autenticado autorizado.
-- Canceladas y bloqueos cancelados se incluyen para trazabilidad visual, pero no bloquean disponibilidad pública.
create or replace function public.get_admin_schedule(
  p_from date,
  p_to date
)
returns table (
  business_id uuid,
  booking_increment_minutes smallint,
  court_id uuid,
  court_name text,
  calendar_date date,
  is_open boolean,
  opens_at time,
  closes_at time,
  schedule_status public.configuration_status,
  entries jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 31 then
    raise exception 'invalid_date_range' using errcode = '22023';
  end if;

  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  return query
  with dates as (
    select generate_series(p_from, p_to, interval '1 day')::date as calendar_date
  ),
  court_days as (
    select
      c.id as court_id,
      c.name as court_name,
      d.calendar_date,
      oh.is_open,
      oh.opens_at,
      oh.closes_at,
      coalesce(oh.configuration_status, c.configuration_status) as schedule_status
    from public.courts c
    cross join dates d
    left join lateral (
      select o.*
      from public.operating_hours o
      where o.court_id = c.id
        and o.weekday = extract(isodow from d.calendar_date)::smallint
        and d.calendar_date >= o.effective_from
        and (o.effective_until is null or d.calendar_date <= o.effective_until)
      order by o.effective_from desc
      limit 1
    ) oh on true
    where c.business_id = v_actor.business_id
      and c.is_active
  ),
  schedule_entries as (
    select
      r.court_id,
      (r.start_at at time zone v_actor.timezone)::date as calendar_date,
      jsonb_build_object(
        'entryKind', 'reservation',
        'id', r.id,
        'status', r.status,
        'startAt', r.start_at,
        'endAt', r.end_at,
        'customerName', cu.full_name,
        'customerPhoneE164', cu.phone_e164,
        'lighting', r.lighting,
        'hourlyRate', r.hourly_rate,
        'totalAmount', r.total_amount,
        'currency', v_actor.currency,
        'source', r.source,
        'blockReason', null,
        'internalNote', null
      ) as payload,
      r.start_at as ordering_start
    from public.reservations r
    left join public.customers cu
      on cu.id = r.customer_id and cu.business_id = r.business_id
    where r.business_id = v_actor.business_id
      and (r.start_at at time zone v_actor.timezone)::date between p_from and p_to

    union all

    select
      sb.court_id,
      (sb.start_at at time zone v_actor.timezone)::date as calendar_date,
      jsonb_build_object(
        'entryKind', 'block',
        'id', sb.id,
        'status', sb.status,
        'startAt', sb.start_at,
        'endAt', sb.end_at,
        'customerName', null,
        'customerPhoneE164', null,
        'lighting', null,
        'hourlyRate', null,
        'totalAmount', null,
        'currency', v_actor.currency,
        'source', null,
        'blockReason', sb.reason,
        'internalNote', sb.internal_note
      ) as payload,
      sb.start_at as ordering_start
    from public.schedule_blocks sb
    where sb.business_id = v_actor.business_id
      and (sb.start_at at time zone v_actor.timezone)::date between p_from and p_to
  )
  select
    v_actor.business_id,
    v_actor.booking_increment_minutes,
    cd.court_id,
    cd.court_name,
    cd.calendar_date,
    coalesce(cd.is_open, false),
    cd.opens_at,
    cd.closes_at,
    cd.schedule_status,
    coalesce(
      (
        select jsonb_agg(se.payload order by se.ordering_start)
        from schedule_entries se
        where se.court_id = cd.court_id
          and se.calendar_date = cd.calendar_date
      ),
      '[]'::jsonb
    )
  from court_days cd
  order by cd.court_name, cd.calendar_date;
end;
$$;

-- Confirmación idempotente: pending -> confirmed. Confirmed vuelve a responder sin crear otra ocupación.
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

  update public.reservations
  set status = 'confirmed',
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
end;
$$;

-- Cancelación idempotente. pending/confirmed -> cancelled. Completed no puede cancelarse.
create or replace function public.admin_cancel_reservation(p_reservation_id uuid)
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

  if v_reservation.status = 'cancelled' then
    return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
    return;
  end if;

  if v_reservation.status not in ('pending', 'confirmed') then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  update public.reservations
  set status = 'cancelled',
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
end;
$$;

-- Reserva manual: owner/admin/staff. Siempre nace CONFIRMED porque es una operación explícita del personal.
-- Precio/total/negocio/estado se resuelven en servidor.
create or replace function public.admin_create_manual_reservation(
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_lighting public.lighting_mode,
  p_customer_name text,
  p_phone_e164 text,
  p_source public.reservation_source default 'admin'
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
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  if p_source is null or p_source = 'public_web' then
    raise exception 'invalid_admin_source' using errcode = '22023';
  end if;
  if p_lighting is null then
    raise exception 'invalid_lighting' using errcode = '22023';
  end if;

  v_name := regexp_replace(trim(coalesce(p_customer_name, '')), '\s+', ' ', 'g');
  v_phone := trim(coalesce(p_phone_e164, ''));

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_customer_name' using errcode = '22023';
  end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone_e164' using errcode = '22023';
  end if;
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

  if not found then
    raise exception 'pricing_not_found' using errcode = 'P0002';
  end if;

  insert into public.customers (business_id, full_name, phone_e164)
  values (v_actor.business_id, v_name, v_phone)
  on conflict (business_id, phone_e164) where phone_e164 is not null and archived_at is null
  do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_customer_id;

  begin
    insert into public.reservations (
      business_id, court_id, customer_id, start_at, end_at, status,
      lighting, hourly_rate, total_amount, source, created_by,
      last_modified_by, status_changed_at
    ) values (
      v_actor.business_id,
      p_court_id,
      v_customer_id,
      v_window.start_at,
      v_window.end_at,
      'confirmed',
      p_lighting,
      v_rate.hourly_rate,
      round(v_rate.hourly_rate * v_window.duration_minutes / 60.0, 2),
      p_source,
      v_actor.user_id,
      v_actor.user_id,
      now()
    ) returning * into v_reservation;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;

  return query select
    v_reservation.id,
    v_reservation.status,
    v_reservation.court_id,
    v_reservation.start_at,
    v_reservation.end_at,
    v_reservation.lighting,
    v_reservation.hourly_rate,
    v_reservation.total_amount,
    v_actor.currency;
end;
$$;

-- Edición sensible: solo owner/admin. Staff puede operar estados y agenda, pero no reescribir una reserva existente.
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
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role = 'staff' then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id and r.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if v_reservation.status not in ('pending', 'confirmed') then
    raise exception 'reservation_not_editable' using errcode = '22023';
  end if;

  v_name := regexp_replace(trim(coalesce(p_customer_name, '')), '\s+', ' ', 'g');
  v_phone := trim(coalesce(p_phone_e164, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'invalid_customer_name' using errcode = '22023';
  end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone_e164' using errcode = '22023';
  end if;
  if p_lighting is null then
    raise exception 'invalid_lighting' using errcode = '22023';
  end if;

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

  if not found then
    raise exception 'pricing_not_found' using errcode = 'P0002';
  end if;

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

  return query select
    v_reservation.id,
    v_reservation.status,
    v_reservation.court_id,
    v_reservation.start_at,
    v_reservation.end_at,
    v_reservation.lighting,
    v_reservation.hourly_rate,
    v_reservation.total_amount,
    v_actor.currency;
end;
$$;

create or replace function public.admin_create_schedule_block(
  p_court_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_reason public.block_reason,
  p_internal_note text default null
)
returns table (
  block_id uuid,
  block_status public.block_status,
  court_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  reason public.block_reason
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_window record;
  v_block public.schedule_blocks%rowtype;
  v_note text;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if p_reason is null then
    raise exception 'invalid_block_reason' using errcode = '22023';
  end if;

  select * into v_window
  from public.phase6_resolve_window(v_actor.business_id, p_court_id, p_date, p_start_time, p_end_time);

  v_note := nullif(left(trim(coalesce(p_internal_note, '')), 500), '');

  begin
    insert into public.schedule_blocks (
      business_id, court_id, start_at, end_at, status, reason,
      internal_note, created_by, last_modified_by, status_changed_at
    ) values (
      v_actor.business_id,
      p_court_id,
      v_window.start_at,
      v_window.end_at,
      'active',
      p_reason,
      v_note,
      v_actor.user_id,
      v_actor.user_id,
      now()
    ) returning * into v_block;
  exception when exclusion_violation then
    raise exception 'slot_unavailable' using errcode = '23P01';
  end;

  return query select v_block.id, v_block.status, v_block.court_id, v_block.start_at, v_block.end_at, v_block.reason;
end;
$$;

-- Desbloquear = transición active -> cancelled. Es idempotente y libera el ledger por el trigger existente.
create or replace function public.admin_cancel_schedule_block(p_block_id uuid)
returns table (
  block_id uuid,
  block_status public.block_status,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_block public.schedule_blocks%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  select sb.* into v_block
  from public.schedule_blocks sb
  where sb.id = p_block_id and sb.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'block_not_found' using errcode = 'P0002';
  end if;

  if v_block.status = 'cancelled' then
    return query select v_block.id, v_block.status, v_block.updated_at;
    return;
  end if;

  update public.schedule_blocks
  set status = 'cancelled',
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_block.id
  returning * into v_block;

  return query select v_block.id, v_block.status, v_block.updated_at;
end;
$$;

-- Mantener DML directo cerrado; solo RPCs específicas pueden mutar.
revoke insert, update, delete on public.businesses, public.courts, public.profiles,
  public.operating_hours, public.pricing_rules, public.customers,
  public.reservations, public.schedule_blocks from authenticated;

-- Helpers internos nunca son parte de la API de aplicación.
revoke all on function public.phase6_admin_actor() from public, anon, authenticated;
revoke all on function public.phase6_resolve_window(uuid, uuid, date, time, time) from public, anon, authenticated;

-- RPC de lectura y mutaciones: solo authenticated. Las propias funciones vuelven a validar perfil/rol/negocio.
revoke all on function public.get_admin_schedule(date, date) from public, anon, authenticated;
revoke all on function public.admin_confirm_reservation(uuid) from public, anon, authenticated;
revoke all on function public.admin_cancel_reservation(uuid) from public, anon, authenticated;
revoke all on function public.admin_create_manual_reservation(uuid, date, time, time, public.lighting_mode, text, text, public.reservation_source) from public, anon, authenticated;
revoke all on function public.admin_edit_reservation(uuid, uuid, date, time, time, public.lighting_mode, text, text) from public, anon, authenticated;
revoke all on function public.admin_create_schedule_block(uuid, date, time, time, public.block_reason, text) from public, anon, authenticated;
revoke all on function public.admin_cancel_schedule_block(uuid) from public, anon, authenticated;

grant execute on function public.get_admin_schedule(date, date) to authenticated;
grant execute on function public.admin_confirm_reservation(uuid) to authenticated;
grant execute on function public.admin_cancel_reservation(uuid) to authenticated;
grant execute on function public.admin_create_manual_reservation(uuid, date, time, time, public.lighting_mode, text, text, public.reservation_source) to authenticated;
grant execute on function public.admin_edit_reservation(uuid, uuid, date, time, time, public.lighting_mode, text, text) to authenticated;
grant execute on function public.admin_create_schedule_block(uuid, date, time, time, public.block_reason, text) to authenticated;
grant execute on function public.admin_cancel_schedule_block(uuid) to authenticated;

-- Anon continúa completamente aislado de PII y superficie administrativa.
revoke all on public.profiles, public.customers, public.reservations, public.schedule_blocks, public.court_schedule_entries from anon;

comment on function public.get_admin_schedule(date, date) is
  'Fase 6: pizarra privada por negocio derivado de auth.uid(); incluye PII mínima solo para owner/admin/staff autorizados.';
comment on function public.admin_confirm_reservation(uuid) is
  'Fase 6: confirmación idempotente pending->confirmed; no crea una segunda ocupación.';
comment on function public.admin_cancel_reservation(uuid) is
  'Fase 6: cancelación idempotente pending/confirmed->cancelled; el trigger existente libera el ledger.';
comment on function public.admin_create_manual_reservation(uuid, date, time, time, public.lighting_mode, text, text, public.reservation_source) is
  'Fase 6: reserva manual confirmed con precio/total autoritativos y protección EXCLUDE contra solapamientos.';
comment on function public.admin_edit_reservation(uuid, uuid, date, time, time, public.lighting_mode, text, text) is
  'Fase 6: edición owner/admin de pending/confirmed; recalcula tarifa y vuelve a validar agenda.';
comment on function public.admin_create_schedule_block(uuid, date, time, time, public.block_reason, text) is
  'Fase 6: bloqueo operativo con validación de horario y protección de concurrencia.';
comment on function public.admin_cancel_schedule_block(uuid) is
  'Fase 6: desbloqueo idempotente mediante status cancelled.';
