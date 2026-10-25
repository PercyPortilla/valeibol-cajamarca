-- Bloque 28 · correcciones estructurales seguras antes del historial operativo.
-- Permite corregir errores de alta sin reescribir el significado de reservas
-- o bloqueos históricos. El tenant siempre se deriva desde auth.uid().

create or replace function public.admin_update_venue_slug(
  p_venue_id uuid,
  p_slug text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_business public.businesses%rowtype;
  v_venue public.venues%rowtype;
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if p_venue_id is null or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
    raise exception 'invalid_venue_slug' using errcode = '22023';
  end if;

  -- Mismo orden de lock que B22/B23/B24: business primero.
  select b.* into v_business
  from public.businesses b
  where b.id = v_actor.business_id and b.is_active
  for update;
  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;
  if v_business.configuration_status <> 'provisional' then
    raise exception 'business_must_be_unpublished_for_structure_correction' using errcode = '22023';
  end if;

  select v.* into v_venue
  from public.venues v
  where v.id = p_venue_id and v.business_id = v_actor.business_id
  for update;
  if not found then
    raise exception 'venue_not_found' using errcode = 'P0002';
  end if;
  if v_slug = v_venue.slug then
    return true;
  end if;
  if exists (
    select 1 from public.venues v
    where v.business_id = v_actor.business_id
      and v.slug = v_slug
      and v.id <> p_venue_id
  ) then
    raise exception 'venue_slug_taken' using errcode = '23505';
  end if;

  update public.venues
  set slug = v_slug,
      updated_at = now()
  where id = p_venue_id and business_id = v_actor.business_id;

  return true;
end;
$$;

create or replace function public.admin_update_court_structure(
  p_court_id uuid,
  p_venue_id uuid,
  p_sport_id uuid,
  p_slug text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_business public.businesses%rowtype;
  v_court public.courts%rowtype;
  v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found or v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;
  if p_court_id is null or p_venue_id is null or p_sport_id is null
     or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
    raise exception 'invalid_court_structure' using errcode = '22023';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_actor.business_id and b.is_active
  for update;
  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;
  if v_business.configuration_status <> 'provisional' then
    raise exception 'business_must_be_unpublished_for_structure_correction' using errcode = '22023';
  end if;

  select c.* into v_court
  from public.courts c
  where c.id = p_court_id and c.business_id = v_actor.business_id
  for update;
  if not found then
    raise exception 'court_not_found' using errcode = 'P0002';
  end if;

  if v_slug = v_court.slug and p_venue_id = v_court.venue_id and p_sport_id = v_court.sport_id then
    return true;
  end if;
  if v_court.is_active then
    raise exception 'court_must_be_inactive_for_structure_correction' using errcode = '22023';
  end if;

  -- Reservas y bloqueos son historia operativa. Reasignar sede/deporte después
  -- de existirlos cambiaría el significado retrospectivo de esos registros.
  if exists (
    select 1 from public.reservations r
    where r.business_id = v_actor.business_id and r.court_id = p_court_id
  ) then
    raise exception 'court_structure_change_blocked_by_reservation_history' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.schedule_blocks sb
    where sb.business_id = v_actor.business_id and sb.court_id = p_court_id
  ) then
    raise exception 'court_structure_change_blocked_by_schedule_history' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.courts c
    where c.business_id = v_actor.business_id
      and c.slug = v_slug
      and c.id <> p_court_id
  ) then
    raise exception 'court_slug_taken' using errcode = '23505';
  end if;

  -- La sede actual puede estar inactiva mientras se corrige. Una sede distinta
  -- sí debe estar activa para evitar mover la cancha a una dependencia inválida.
  perform 1
  from public.venues v
  where v.id = p_venue_id
    and v.business_id = v_actor.business_id
    and (p_venue_id = v_court.venue_id or v.is_active)
  for share;
  if not found then
    raise exception 'target_venue_not_found_or_inactive' using errcode = 'P0002';
  end if;

  -- El deporte actual puede haber sido desactivado globalmente. Cambiar a otro
  -- deporte exige que el nuevo destino esté activo.
  perform 1
  from public.sports s
  where s.id = p_sport_id
    and (p_sport_id = v_court.sport_id or s.is_active)
  for share;
  if not found then
    raise exception 'target_sport_not_found_or_inactive' using errcode = 'P0002';
  end if;

  update public.courts
  set venue_id = p_venue_id,
      sport_id = p_sport_id,
      slug = v_slug,
      updated_at = now()
  where id = p_court_id and business_id = v_actor.business_id;

  insert into public.availability_revisions (business_id, revision, updated_at)
  values (v_actor.business_id, 1, now())
  on conflict (business_id) do update
    set revision = public.availability_revisions.revision + 1,
        updated_at = now();

  return true;
end;
$$;

revoke all on function public.admin_update_venue_slug(uuid,text) from public, anon, authenticated;
revoke all on function public.admin_update_court_structure(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_update_venue_slug(uuid,text) to authenticated;
grant execute on function public.admin_update_court_structure(uuid,uuid,uuid,text) to authenticated;

comment on function public.admin_update_venue_slug(uuid,text) is
  'B28: owner/admin corrige slug de sede solo con tenant provisional; tenant derivado de auth.';
comment on function public.admin_update_court_structure(uuid,uuid,uuid,text) is
  'B28: owner/admin corrige slug/sede/deporte de cancha inactiva y sin historial, solo con tenant provisional.';
