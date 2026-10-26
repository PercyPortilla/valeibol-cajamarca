-- BLOQUE 30 · Retiro seguro de solicitudes pendientes por el propio cliente.
-- El cliente solo puede retirar una reserva futura PENDING vinculada a auth.uid().
-- Reservas confirmadas/completadas y solicitudes con pago abierto deben coordinarse con el negocio.

drop function if exists public.get_my_reservations();

create function public.get_my_reservations()
returns table (
  reservation_id uuid,
  business_id uuid,
  business_slug text,
  business_name text,
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
  can_withdraw boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id,
    b.id,
    b.slug,
    b.name,
    c.id,
    c.name,
    s.slug,
    s.name,
    r.start_at,
    r.end_at,
    r.status,
    r.lighting,
    r.net_height_cm,
    r.total_amount,
    b.currency,
    r.created_at,
    (
      r.status = 'pending'
      and r.source = 'public_web'
      and r.start_at > now()
      and not exists (
        select 1
        from public.reservation_payments rp
        where rp.reservation_id = r.id
          and rp.business_id = r.business_id
          and rp.status in ('reported', 'verified')
      )
    ) as can_withdraw
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  join public.sports s on s.id = c.sport_id
  where r.user_id = (select auth.uid())
    and exists (
      select 1
      from public.user_accounts ua
      where ua.user_id = (select auth.uid())
        and ua.is_active
    )
  order by r.start_at desc, r.created_at desc;
$$;

revoke all on function public.get_my_reservations() from public, anon;
grant execute on function public.get_my_reservations() to authenticated;

comment on function public.get_my_reservations() is
  'Historial privado del usuario autenticado; B30 añade can_withdraw derivado en servidor sin exponer el ledger de pagos.';

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

  -- FOR UPDATE serializa contra confirmación/cancelación administrativa y contra
  -- report_my_payment(), que toma FOR SHARE antes de crear un pago.
  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.user_id = v_uid
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  -- Repetir el retiro de una reserva propia ya cancelada es idempotente.
  if v_reservation.status = 'cancelled' then
    return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
    return;
  end if;

  if v_reservation.status <> 'pending' then
    raise exception 'reservation_not_withdrawable' using errcode = '22023';
  end if;
  if v_reservation.source <> 'public_web' then
    raise exception 'reservation_not_withdrawable' using errcode = '22023';
  end if;
  if v_reservation.start_at <= now() then
    raise exception 'reservation_withdrawal_window_closed' using errcode = '22023';
  end if;

  -- El orden de locks es siempre reservation -> payment. Si un pago abierto existe,
  -- se bloquea también su fila para que una revisión administrativa concurrente no
  -- cambie la decisión a mitad de la operación.
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
      last_modified_by = v_uid,
      status_changed_at = now()
  where r.id = v_reservation.id
  returning r.* into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
end;
$$;

revoke all on function public.withdraw_my_pending_reservation(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_my_pending_reservation(uuid) to authenticated;

comment on function public.withdraw_my_pending_reservation(uuid) is
  'B30: cliente autenticado retira idempotentemente solo su solicitud futura PENDING sin pago abierto; identidad derivada de auth.uid().';

comment on column public.reservations.last_modified_by is
  'Último usuario autenticado que modificó operativamente la reserva; puede ser personal autorizado o el cliente en un retiro B30.';
