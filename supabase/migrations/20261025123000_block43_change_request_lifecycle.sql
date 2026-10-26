-- Bloque 43 · consistencia del lifecycle de solicitudes de cambio.
-- Evita que una transición administrativa terminal deje una solicitud B39/B40
-- pendiente y preserva el orden de locks reservation -> change_request.

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
    return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
    return;
  end if;

  if v_reservation.status not in ('pending', 'confirmed') then
    raise exception 'invalid_status_transition' using errcode = '22023';
  end if;

  if v_reservation.status = 'confirmed' then
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

create or replace function public.admin_complete_reservation(p_reservation_id uuid)
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
  if v_reservation.status = 'completed' then
    return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
    return;
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception 'reservation_not_completable' using errcode = '22023';
  end if;
  if v_reservation.end_at > now() then
    raise exception 'reservation_not_finished' using errcode = '22023';
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
  set status = 'completed',
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
end;
$$;

revoke all on function public.admin_cancel_reservation(uuid) from public, anon;
grant execute on function public.admin_cancel_reservation(uuid) to authenticated;
revoke all on function public.admin_complete_reservation(uuid) from public, anon;
grant execute on function public.admin_complete_reservation(uuid) to authenticated;

comment on function public.admin_cancel_reservation(uuid) is
  'B43: cancela pending/confirmed salvo que una confirmed tenga un change request pendiente; ese request debe resolverse primero.';
comment on function public.admin_complete_reservation(uuid) is
  'B43: completa una confirmed finalizada solo si no existe un change request pendiente que deba resolverse primero.';

