-- Plataforma global · Bloque 7
-- Cuenta cliente e historial propio. Mantiene reservas guest y evita user_id manipulable.

create or replace function public.link_public_reservation_user(
  p_reservation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_business_id uuid;
begin
  if p_reservation_id is null or p_user_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = p_user_id
      and ua.is_active
  ) then
    return false;
  end if;

  update public.reservations r
  set user_id = p_user_id,
      updated_at = now()
  where r.id = p_reservation_id
    and (r.user_id is null or r.user_id = p_user_id)
  returning r.customer_id, r.business_id
  into v_customer_id, v_business_id;

  if not found then
    return false;
  end if;

  if v_customer_id is not null then
    begin
      update public.customers c
      set user_id = p_user_id,
          updated_at = now()
      where c.id = v_customer_id
        and c.business_id = v_business_id
        and (c.user_id is null or c.user_id = p_user_id);
    exception
      when unique_violation then
        -- La identidad global ya está vinculada a otro registro customer del mismo
        -- negocio. La reserva conserva user_id y el historial propio sigue funcionando.
        null;
    end;
  end if;

  return true;
end;
$$;

revoke all on function public.link_public_reservation_user(uuid,uuid)
from public, anon, authenticated;
grant execute on function public.link_public_reservation_user(uuid,uuid)
to service_role;

create or replace function public.get_my_reservations()
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
  created_at timestamptz
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
    r.created_at
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

comment on function public.link_public_reservation_user(uuid,uuid) is
  'Vínculo server-side de una reserva pública con auth.users. Solo service_role puede ejecutarla.';
comment on function public.get_my_reservations() is
  'Historial privado del usuario autenticado; deriva identidad exclusivamente desde auth.uid().';
