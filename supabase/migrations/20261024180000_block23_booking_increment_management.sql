-- Bloque 23 · granularidad de reserva multi-tenant.
-- Permite gestionar booking_increment_minutes sin SQL manual y mantiene
-- consistencia con reservas/bloqueos futuros y calendarios públicos abiertos.

create or replace function public.get_admin_booking_settings()
returns table (
  booking_increment_minutes smallint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.booking_increment_minutes
  from public.phase6_admin_actor() actor
  join public.businesses b on b.id = actor.business_id
  where b.is_active
  limit 1;
$$;

create or replace function public.admin_update_booking_increment(
  p_booking_increment_minutes smallint
)
returns smallint
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_business public.businesses%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if p_booking_increment_minutes is null
     or p_booking_increment_minutes < 15
     or p_booking_increment_minutes > 240
     or mod(1440, p_booking_increment_minutes) <> 0 then
    raise exception 'invalid_booking_increment' using errcode = '22023';
  end if;

  -- phase6_resolve_window y la creación pública toman esta misma fila FOR SHARE.
  -- El lock exclusivo hace del negocio la barrera de serialización del cambio.
  select b.* into v_business
  from public.businesses b
  where b.id = v_actor.business_id
    and b.is_active
  for update;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  if v_business.booking_increment_minutes = p_booking_increment_minutes then
    return p_booking_increment_minutes;
  end if;

  -- No se bloquean reservation/schedule_blocks: admin_edit_reservation puede
  -- tomar reservation -> business. El lock de business ya serializa la
  -- validación final y evita invertir ese orden.
  if exists (
    select 1
    from public.reservations r
    cross join lateral (
      select
        (r.start_at at time zone v_business.timezone) as local_start,
        (r.end_at at time zone v_business.timezone) as local_end
    ) local
    left join lateral (
      select oh.*
      from public.operating_hours oh
      where oh.court_id = r.court_id
        and oh.weekday = extract(isodow from local.local_start)::smallint
        and local.local_start::date >= oh.effective_from
        and (oh.effective_until is null or local.local_start::date <= oh.effective_until)
      order by oh.effective_from desc
      limit 1
    ) hours on true
    where r.business_id = v_business.id
      and r.status in ('pending', 'confirmed')
      and r.start_at > now()
      and (
        local.local_start::date <> local.local_end::date
        or hours.id is null
        or not hours.is_open
        or hours.opens_at is null
        or hours.closes_at is null
        or local.local_start::time < hours.opens_at
        or local.local_end::time > hours.closes_at
        or mod(
          (extract(epoch from (local.local_end::time - local.local_start::time)) / 60.0)::numeric,
          p_booking_increment_minutes::numeric
        ) <> 0
        or mod(
          (extract(epoch from (local.local_start::time - hours.opens_at)) / 60.0)::numeric,
          p_booking_increment_minutes::numeric
        ) <> 0
      )
    limit 1
  ) then
    raise exception 'booking_increment_conflict_future_reservations' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.schedule_blocks sb
    cross join lateral (
      select
        (sb.start_at at time zone v_business.timezone) as local_start,
        (sb.end_at at time zone v_business.timezone) as local_end
    ) local
    left join lateral (
      select oh.*
      from public.operating_hours oh
      where oh.court_id = sb.court_id
        and oh.weekday = extract(isodow from local.local_start)::smallint
        and local.local_start::date >= oh.effective_from
        and (oh.effective_until is null or local.local_start::date <= oh.effective_until)
      order by oh.effective_from desc
      limit 1
    ) hours on true
    where sb.business_id = v_business.id
      and sb.status = 'active'
      and sb.start_at > now()
      and (
        local.local_start::date <> local.local_end::date
        or hours.id is null
        or not hours.is_open
        or hours.opens_at is null
        or hours.closes_at is null
        or local.local_start::time < hours.opens_at
        or local.local_end::time > hours.closes_at
        or mod(
          (extract(epoch from (local.local_end::time - local.local_start::time)) / 60.0)::numeric,
          p_booking_increment_minutes::numeric
        ) <> 0
        or mod(
          (extract(epoch from (local.local_start::time - hours.opens_at)) / 60.0)::numeric,
          p_booking_increment_minutes::numeric
        ) <> 0
      )
    limit 1
  ) then
    raise exception 'booking_increment_conflict_future_blocks' using errcode = '22023';
  end if;

  update public.businesses
  set booking_increment_minutes = p_booking_increment_minutes,
      updated_at = now()
  where id = v_business.id;

  insert into public.availability_revisions (business_id, revision, updated_at)
  values (v_business.id, 1, now())
  on conflict (business_id) do update
    set revision = public.availability_revisions.revision + 1,
        updated_at = now();

  return p_booking_increment_minutes;
end;
$$;

revoke all on function public.get_admin_booking_settings() from public, anon, authenticated;
revoke all on function public.admin_update_booking_increment(smallint) from public, anon, authenticated;

grant execute on function public.get_admin_booking_settings() to authenticated;
grant execute on function public.admin_update_booking_increment(smallint) to authenticated;

comment on function public.get_admin_booking_settings() is
  'B23: lectura tenant del intervalo de reserva vigente; requiere perfil administrativo activo.';
comment on function public.admin_update_booking_increment(smallint) is
  'B23: owner/admin cambia la granularidad de reserva tras validar reservas y bloqueos futuros bajo horario local.';
