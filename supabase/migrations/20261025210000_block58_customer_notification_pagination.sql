-- Caxas Sport Center · Bloque 58
-- Elimina el truncamiento silencioso del centro de notificaciones del cliente
-- mediante paginación keyset server-side sobre su propia identidad autenticada.

create or replace function public.get_my_notifications_page(
  p_limit integer default 41,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
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
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = v_uid
      and ua.is_active
  ) then
    raise exception 'customer_account_required' using errcode = '42501';
  end if;

  if num_nonnulls(p_cursor_created_at, p_cursor_id) not in (0, 2) then
    raise exception 'invalid_customer_notification_cursor' using errcode = '22023';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 41), 101));

  return query
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
  join public.businesses b
    on b.id = n.business_id
  left join public.reservations r
    on r.id = n.reservation_id
   and r.business_id = n.business_id
  left join public.courts c
    on c.id = r.court_id
   and c.business_id = n.business_id
  left join public.reservation_change_requests q
    on q.id = n.change_request_id
   and q.business_id = n.business_id
  left join public.courts requested
    on requested.id = q.requested_court_id
   and requested.business_id = n.business_id
  left join public.app_notification_reads reads
    on reads.notification_id = n.id
   and reads.user_id = v_uid
  where n.audience = 'customer'
    and n.recipient_user_id = v_uid
    and (
      p_cursor_created_at is null
      or (n.created_at, n.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by n.created_at desc, n.id desc
  limit v_limit;
end;
$$;

create index if not exists app_notifications_customer_page_idx
  on public.app_notifications (recipient_user_id, created_at desc, id desc)
  where audience = 'customer';

revoke all on function public.get_my_notifications_page(integer,timestamptz,uuid)
  from public, anon, authenticated;
grant execute on function public.get_my_notifications_page(integer,timestamptz,uuid)
  to authenticated;

comment on function public.get_my_notifications_page(integer,timestamptz,uuid) is
  'B58: notificaciones privadas del cliente paginadas por keyset created_at+id para auth.uid(), sin aceptar identidad desde el navegador.';
