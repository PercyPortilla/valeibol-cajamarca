-- Caxas Sport Center · Bloque 56
-- Elimina el truncamiento silencioso del historial append-only de una reserva
-- mediante paginación keyset server-side con claves inmutables.

create or replace function public.get_admin_reservation_audit_page(
  p_reservation_id uuid,
  p_limit integer default 51,
  p_cursor_created_at timestamptz default null,
  p_cursor_event_sequence bigint default null
)
returns table (
  event_id uuid,
  event_sequence bigint,
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
  v_limit integer;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  if num_nonnulls(p_cursor_created_at, p_cursor_event_sequence) not in (0, 2) then
    raise exception 'invalid_reservation_audit_cursor' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.reservations r
    where r.id = p_reservation_id
      and r.business_id = v_actor.business_id
  ) then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 51), 101));

  return query
  select
    e.id,
    e.event_sequence,
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
    and (
      p_cursor_created_at is null
      or (e.created_at, e.event_sequence) < (p_cursor_created_at, p_cursor_event_sequence)
    )
  order by e.created_at desc, e.event_sequence desc
  limit v_limit;
end;
$$;

create index if not exists reservation_audit_events_business_reservation_page_idx
  on public.reservation_audit_events (
    business_id,
    reservation_id,
    created_at desc,
    event_sequence desc
  );

revoke all on function public.get_admin_reservation_audit_page(uuid,integer,timestamptz,bigint)
  from public, anon, authenticated;
grant execute on function public.get_admin_reservation_audit_page(uuid,integer,timestamptz,bigint)
  to authenticated;

comment on function public.get_admin_reservation_audit_page(uuid,integer,timestamptz,bigint) is
  'B56: historial append-only de una reserva paginado por keyset inmutable created_at+event_sequence dentro del tenant derivado del actor.';
