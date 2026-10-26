-- BLOQUE 31 · contacto negocio para historial propio del cliente.
-- Extiende get_my_reservations con el teléfono público/configurado del negocio
-- asociado a la reserva, incluso si el tenant deja de estar publicado después.

drop function if exists public.get_my_reservations();

create function public.get_my_reservations()
returns table (
  reservation_id uuid,
  business_id uuid,
  business_slug text,
  business_name text,
  business_phone text,
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
    b.phone,
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
  'Historial privado propio; B31 añade business_phone para coordinación de reservas sin depender del estado de publicación del tenant.';
