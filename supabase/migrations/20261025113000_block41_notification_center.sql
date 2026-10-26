-- Bloque 41 · centro de notificaciones interno cliente/admin.
-- No depende del outbox WhatsApp y no almacena contenido libre ni PII duplicada.

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  change_request_id uuid references public.reservation_change_requests(id) on delete cascade,
  audience text not null check (audience in ('customer','admin')),
  recipient_user_id uuid references public.user_accounts(user_id) on delete cascade,
  event_type text not null check (event_type in (
    'reservation_requested',
    'reservation_confirmed',
    'cancellation_requested',
    'cancellation_approved',
    'cancellation_rejected',
    'reschedule_requested',
    'reschedule_approved',
    'reschedule_rejected'
  )),
  created_at timestamptz not null default now(),
  check (
    (audience = 'customer' and recipient_user_id is not null)
    or (audience = 'admin' and recipient_user_id is null)
  ),
  check (
    (change_request_id is null and event_type in ('reservation_requested','reservation_confirmed'))
    or
    (change_request_id is not null and event_type in (
      'cancellation_requested','cancellation_approved','cancellation_rejected',
      'reschedule_requested','reschedule_approved','reschedule_rejected'
    ))
  )
);

create unique index if not exists reservations_id_business_b41_unique
  on public.reservations (id, business_id);

create unique index if not exists reservation_change_requests_id_business_b41_unique
  on public.reservation_change_requests (id, business_id);

alter table public.app_notifications
  add constraint app_notifications_reservation_business_fk
  foreign key (reservation_id, business_id)
  references public.reservations(id, business_id)
  on delete cascade;

alter table public.app_notifications
  add constraint app_notifications_change_business_fk
  foreign key (change_request_id, business_id)
  references public.reservation_change_requests(id, business_id)
  on delete cascade;

create unique index if not exists app_notifications_reservation_event_unique
  on public.app_notifications (recipient_user_id, reservation_id, event_type)
  where change_request_id is null and audience = 'customer';

create unique index if not exists app_notifications_admin_reservation_event_unique
  on public.app_notifications (audience, reservation_id, event_type)
  where change_request_id is null and audience = 'admin';

create unique index if not exists app_notifications_change_event_unique
  on public.app_notifications (audience, change_request_id, event_type)
  where change_request_id is not null;

create index if not exists app_notifications_customer_created_idx
  on public.app_notifications (recipient_user_id, created_at desc)
  where audience = 'customer';

create index if not exists app_notifications_admin_created_idx
  on public.app_notifications (business_id, created_at desc)
  where audience = 'admin';

create table if not exists public.app_notification_reads (
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists app_notification_reads_user_idx
  on public.app_notification_reads (user_id, read_at desc);

alter table public.app_notifications enable row level security;
alter table public.app_notification_reads enable row level security;
revoke all on public.app_notifications from public, anon, authenticated;
revoke all on public.app_notification_reads from public, anon, authenticated;

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
      new.business_id,
      new.id,
      'admin',
      null,
      'reservation_requested',
      new.created_at
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
      new.business_id,
      new.id,
      'customer',
      new.user_id,
      'reservation_confirmed',
      v_customer_created_at
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_block41_notification on public.reservations;
create trigger reservations_block41_notification
after insert or update of status, user_id on public.reservations
for each row execute function public.block41_queue_reservation_notification();

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
  v_requested_event := case new.request_type
    when 'cancellation' then 'cancellation_requested'
    when 'reschedule' then 'reschedule_requested'
    else null
  end;

  if tg_op = 'INSERT' and v_requested_event is not null then
    if new.user_id is not null then
      insert into public.app_notifications (
        business_id, reservation_id, change_request_id, audience,
        recipient_user_id, event_type, created_at
      ) values (
        new.business_id, new.reservation_id, new.id, 'customer',
        new.user_id, v_requested_event, new.created_at
      )
      on conflict do nothing;
    end if;

    insert into public.app_notifications (
      business_id, reservation_id, change_request_id, audience,
      recipient_user_id, event_type, created_at
    ) values (
      new.business_id, new.reservation_id, new.id, 'admin',
      null, v_requested_event, new.created_at
    )
    on conflict do nothing;
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status in ('approved','rejected')
     and new.user_id is not null then
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

  return new;
end;
$$;

drop trigger if exists reservation_change_requests_block41_notification on public.reservation_change_requests;
create trigger reservation_change_requests_block41_notification
after insert or update of status on public.reservation_change_requests
for each row execute function public.block41_queue_change_request_notification();

revoke all on function public.block41_queue_reservation_notification() from public, anon, authenticated;
revoke all on function public.block41_queue_change_request_notification() from public, anon, authenticated;

create or replace function public.get_my_notifications(p_limit integer default 40)
returns table (
  notification_id uuid,
  event_type text,
  reservation_id uuid,
  change_request_id uuid,
  business_name text,
  business_timezone text,
  court_name text,
  start_at timestamptz,
  requested_court_name text,
  requested_start_at timestamptz,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    n.id,
    n.event_type,
    n.reservation_id,
    n.change_request_id,
    b.name,
    b.timezone,
    c.name,
    r.start_at,
    requested.name,
    q.requested_start_at,
    n.created_at,
    reads.read_at
  from public.app_notifications n
  join public.businesses b on b.id = n.business_id
  left join public.reservations r on r.id = n.reservation_id and r.business_id = n.business_id
  left join public.courts c on c.id = r.court_id and c.business_id = n.business_id
  left join public.reservation_change_requests q on q.id = n.change_request_id and q.business_id = n.business_id
  left join public.courts requested on requested.id = q.requested_court_id and requested.business_id = n.business_id
  left join public.app_notification_reads reads
    on reads.notification_id = n.id and reads.user_id = (select auth.uid())
  where n.audience = 'customer'
    and n.recipient_user_id = (select auth.uid())
    and exists (
      select 1 from public.user_accounts ua
      where ua.user_id = (select auth.uid()) and ua.is_active
    )
  order by n.created_at desc, n.id desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

create or replace function public.get_my_notification_unread_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.app_notifications n
  where n.audience = 'customer'
    and n.recipient_user_id = (select auth.uid())
    and not exists (
      select 1 from public.app_notification_reads reads
      where reads.notification_id = n.id
        and reads.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.user_accounts ua
      where ua.user_id = (select auth.uid()) and ua.is_active
    );
$$;

create or replace function public.mark_my_notification_read(p_notification_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_read_at timestamptz;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.user_accounts ua
    where ua.user_id = v_uid and ua.is_active
  ) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.app_notifications n
    where n.id = p_notification_id
      and n.audience = 'customer'
      and n.recipient_user_id = v_uid
  ) then
    raise exception 'notification_not_found' using errcode = 'P0002';
  end if;

  insert into public.app_notification_reads (notification_id, user_id, read_at)
  values (p_notification_id, v_uid, now())
  on conflict (notification_id, user_id) do update
    set read_at = public.app_notification_reads.read_at
  returning read_at into v_read_at;
  return v_read_at;
end;
$$;

create or replace function public.mark_all_my_notifications_read()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.user_accounts ua
    where ua.user_id = v_uid and ua.is_active
  ) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  insert into public.app_notification_reads (notification_id, user_id, read_at)
  select n.id, v_uid, now()
  from public.app_notifications n
  where n.audience = 'customer'
    and n.recipient_user_id = v_uid
  on conflict (notification_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.get_admin_notifications(p_limit integer default 60)
returns table (
  notification_id uuid,
  event_type text,
  reservation_id uuid,
  change_request_id uuid,
  court_name text,
  start_at timestamptz,
  requested_court_name text,
  requested_start_at timestamptz,
  created_at timestamptz,
  read_at timestamptz
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
  select
    n.id,
    n.event_type,
    n.reservation_id,
    n.change_request_id,
    c.name,
    r.start_at,
    requested.name,
    q.requested_start_at,
    n.created_at,
    reads.read_at
  from public.app_notifications n
  left join public.reservations r on r.id = n.reservation_id and r.business_id = n.business_id
  left join public.courts c on c.id = r.court_id and c.business_id = n.business_id
  left join public.reservation_change_requests q on q.id = n.change_request_id and q.business_id = n.business_id
  left join public.courts requested on requested.id = q.requested_court_id and requested.business_id = n.business_id
  left join public.app_notification_reads reads
    on reads.notification_id = n.id and reads.user_id = v_actor.user_id
  where n.audience = 'admin'
    and n.business_id = v_actor.business_id
  order by n.created_at desc, n.id desc
  limit greatest(1, least(coalesce(p_limit, 60), 100));
end;
$$;

create or replace function public.get_admin_notification_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_count integer;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then raise exception 'admin_profile_required' using errcode = '42501'; end if;

  select count(*)::integer into v_count
  from public.app_notifications n
  where n.audience = 'admin'
    and n.business_id = v_actor.business_id
    and not exists (
      select 1 from public.app_notification_reads reads
      where reads.notification_id = n.id and reads.user_id = v_actor.user_id
    );
  return v_count;
end;
$$;

create or replace function public.mark_admin_notification_read(p_notification_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_read_at timestamptz;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then raise exception 'admin_profile_required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.app_notifications n
    where n.id = p_notification_id
      and n.audience = 'admin'
      and n.business_id = v_actor.business_id
  ) then
    raise exception 'notification_not_found' using errcode = 'P0002';
  end if;

  insert into public.app_notification_reads (notification_id, user_id, read_at)
  values (p_notification_id, v_actor.user_id, now())
  on conflict (notification_id, user_id) do update
    set read_at = public.app_notification_reads.read_at
  returning read_at into v_read_at;
  return v_read_at;
end;
$$;

create or replace function public.mark_all_admin_notifications_read()
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_count integer;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then raise exception 'admin_profile_required' using errcode = '42501'; end if;

  insert into public.app_notification_reads (notification_id, user_id, read_at)
  select n.id, v_actor.user_id, now()
  from public.app_notifications n
  where n.audience = 'admin'
    and n.business_id = v_actor.business_id
  on conflict (notification_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cutover limpio: B41 empieza a registrar eventos desde su instalación.
-- No se fabrican notificaciones históricas ni se convierten actividades antiguas en "no leídas".

revoke all on function public.get_my_notifications(integer) from public, anon;
revoke all on function public.get_my_notification_unread_count() from public, anon;
revoke all on function public.mark_my_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_my_notifications_read() from public, anon;
revoke all on function public.get_admin_notifications(integer) from public, anon;
revoke all on function public.get_admin_notification_unread_count() from public, anon;
revoke all on function public.mark_admin_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_admin_notifications_read() from public, anon;

grant execute on function public.get_my_notifications(integer) to authenticated;
grant execute on function public.get_my_notification_unread_count() to authenticated;
grant execute on function public.mark_my_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_my_notifications_read() to authenticated;
grant execute on function public.get_admin_notifications(integer) to authenticated;
grant execute on function public.get_admin_notification_unread_count() to authenticated;
grant execute on function public.mark_admin_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_admin_notifications_read() to authenticated;

comment on table public.app_notifications is
  'B41: eventos internos idempotentes para UI cliente/admin; sin contenido libre ni dependencia de WhatsApp.';
comment on table public.app_notification_reads is
  'B41: estado de lectura por usuario; permite que varios operadores del mismo tenant lean una notificación de forma independiente.';

