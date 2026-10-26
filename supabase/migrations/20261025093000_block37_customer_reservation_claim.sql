-- Bloque 37 · recuperación segura de reservas públicas no vinculadas.

create or replace function public.claim_public_reservation(p_request_token uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_reservation public.reservations%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_request_token is null then
    raise exception 'reservation_claim_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.user_accounts ua
    where ua.user_id = v_user_id and ua.is_active
  ) then
    raise exception 'customer_account_inactive' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.request_token = p_request_token
    and r.source = 'public_web'
  for update;

  if not found then
    raise exception 'reservation_claim_invalid' using errcode = 'P0002';
  end if;
  if v_reservation.user_id is not null and v_reservation.user_id <> v_user_id then
    raise exception 'reservation_claim_invalid' using errcode = 'P0002';
  end if;

  if v_reservation.user_id is null then
    update public.reservations r
    set user_id = v_user_id, updated_at = now()
    where r.id = v_reservation.id;
  end if;

  if v_reservation.customer_id is not null then
    begin
      update public.customers c
      set user_id = v_user_id, updated_at = now()
      where c.id = v_reservation.customer_id
        and c.business_id = v_reservation.business_id
        and (c.user_id is null or c.user_id = v_user_id);
    exception when unique_violation then
      null;
    end;
  end if;

  return v_reservation.id;
end;
$$;

revoke all on function public.claim_public_reservation(uuid) from public, anon;
grant execute on function public.claim_public_reservation(uuid) to authenticated;

comment on function public.claim_public_reservation(uuid) is
  'B37: vincula una reserva public_web a auth.uid() usando request_token como secreto de posesión; idempotente para la misma cuenta y opaco para reservas ajenas.';

