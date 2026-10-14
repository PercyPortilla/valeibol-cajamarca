-- Valeibol · Fase 5
-- Autenticación administrativa, mínimo privilegio y lectura segura de solicitudes.
-- No implementa todavía mutaciones administrativas de Fase 6.

-- Fase 5 es de lectura administrativa. Aunque existan políticas RLS de escritura de Fase 3,
-- quitamos los privilegios DML directos al rol authenticated. Fase 6 deberá exponer RPCs
-- específicas para confirmar/cancelar/editar sin volver a abrir tablas completas.
revoke insert, update, delete on public.businesses, public.courts, public.profiles,
  public.operating_hours, public.pricing_rules, public.customers,
  public.reservations, public.schedule_blocks from authenticated;

grant select on public.businesses, public.courts, public.profiles,
  public.operating_hours, public.pricing_rules, public.customers,
  public.reservations, public.schedule_blocks to authenticated;

-- Contexto administrativo del usuario autenticado. No acepta business_id aportado por cliente:
-- el negocio se deriva del perfil activo vinculado a auth.uid().
create or replace function public.get_current_admin_context()
returns table (
  user_id uuid,
  business_id uuid,
  business_name text,
  role public.app_role,
  display_name text,
  timezone text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.user_id,
    p.business_id,
    b.name,
    p.role,
    p.display_name,
    b.timezone
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where p.user_id = auth.uid()
    and p.is_active
    and b.is_active
    and p.role in ('owner', 'admin', 'staff')
  limit 1;
$$;

-- Vista/RPC administrativa de solo lectura. Devuelve únicamente lo que el negocio necesita
-- para operar una solicitud, incluida la PII mínima del cliente. No expone internal_notes.
create or replace function public.get_admin_reservation_requests(
  p_limit integer default 100
)
returns table (
  reservation_id uuid,
  business_id uuid,
  court_id uuid,
  court_name text,
  customer_id uuid,
  customer_name text,
  customer_phone_e164 text,
  start_at timestamptz,
  end_at timestamptz,
  status public.reservation_status,
  lighting public.lighting_mode,
  hourly_rate numeric,
  total_amount numeric,
  currency text,
  source public.reservation_source,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select p.business_id into v_business_id
  from public.profiles p
  join public.businesses b on b.id = p.business_id and b.is_active
  where p.user_id = auth.uid()
    and p.is_active
    and p.role in ('owner', 'admin', 'staff')
  limit 1;

  if v_business_id is null then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 100), 200));

  return query
  select
    r.id,
    r.business_id,
    r.court_id,
    c.name,
    r.customer_id,
    cu.full_name,
    cu.phone_e164,
    r.start_at,
    r.end_at,
    r.status,
    r.lighting,
    r.hourly_rate,
    r.total_amount,
    b.currency,
    r.source,
    r.created_at
  from public.reservations r
  join public.businesses b on b.id = r.business_id
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  left join public.customers cu on cu.id = r.customer_id and cu.business_id = r.business_id
  where r.business_id = v_business_id
  order by r.start_at desc, r.created_at desc
  limit v_limit;
end;
$$;

-- Superficie de funciones: jamás anónima.
revoke all on function public.get_current_admin_context() from public, anon, authenticated;
revoke all on function public.get_admin_reservation_requests(integer) from public, anon, authenticated;
grant execute on function public.get_current_admin_context() to authenticated;
grant execute on function public.get_admin_reservation_requests(integer) to authenticated;

-- Reafirmar cierre anónimo de PII y administración.
revoke all on public.profiles, public.customers, public.reservations, public.schedule_blocks from anon;

comment on function public.get_current_admin_context() is
  'Fase 5: contexto administrativo del usuario autenticado derivado de auth.uid(); no disponible para anon.';
comment on function public.get_admin_reservation_requests(integer) is
  'Fase 5: lectura administrativa limitada al negocio del perfil activo; incluye PII mínima solo para authenticated autorizado.';
