-- Bloque 50 · inmutabilidad de solicitudes public_web PENDING.
-- Una solicitud enviada por el cliente conserva cancha/horario/valor/datos
-- hasta Confirmar, Rechazar o Expirar. La edición administrativa queda
-- reservada a PENDING creadas por canales internos.

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
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role = 'staff' then
    raise exception 'insufficient_role' using errcode = '42501';
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
    raise exception 'confirmed_reschedule_requires_request' using errcode = '22023';
  end if;
  if v_reservation.status <> 'pending' then
    raise exception 'reservation_not_editable' using errcode = '22023';
  end if;
  if v_reservation.start_at <= now() then
    raise exception 'pending_reservation_expired_requires_expiration' using errcode = '22023';
  end if;
  if v_reservation.source = 'public_web' then
    raise exception 'public_pending_request_not_editable' using errcode = '22023';
  end if;
  if p_net_height_cm is null or p_net_height_cm not between 180 and 250 then
    raise exception 'invalid_net_height' using errcode = '22023';
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

  if not found then
    raise exception 'pricing_not_found' using errcode = 'P0002';
  end if;

  insert into public.customers (business_id, full_name, phone_e164)
  values (v_actor.business_id, v_name, v_phone)
  on conflict (business_id, phone_e164)
    where phone_e164 is not null and archived_at is null
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
    v_reservation.id,
    v_reservation.status,
    v_reservation.court_id,
    v_reservation.start_at,
    v_reservation.end_at,
    v_reservation.lighting,
    v_reservation.net_height_cm,
    v_reservation.hourly_rate,
    v_reservation.total_amount,
    v_actor.currency;
end;
$$;

revoke all on function public.admin_edit_reservation(
  uuid, uuid, date, time, time, smallint, text, text
) from public, anon, authenticated;
grant execute on function public.admin_edit_reservation(
  uuid, uuid, date, time, time, smallint, text, text
) to authenticated;

comment on function public.admin_edit_reservation(
  uuid, uuid, date, time, time, smallint, text, text
) is
  'B50: edita solo PENDING internas futuras; public_web es inmutable y debe resolverse con Confirmar, Rechazar o Expirar.';
