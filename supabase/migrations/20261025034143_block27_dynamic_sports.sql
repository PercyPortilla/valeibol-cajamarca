-- B27 — catálogo global de deportes dinámico.
-- Los deportes pertenecen a la plataforma, no a un tenant. Solo ADMIN global
-- puede mutarlos; el catálogo público expone únicamente deportes activos.

create or replace function public.get_public_sports()
returns table (
  sport_id uuid,
  slug text,
  name text,
  icon text,
  sort_order integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.slug, s.name, s.icon, s.sort_order
  from public.sports s
  where s.is_active
  order by s.sort_order, s.name, s.id;
$$;

create or replace function public.get_platform_admin_sports()
returns table (
  sport_id uuid,
  slug text,
  name text,
  icon text,
  is_active boolean,
  sort_order integer,
  active_court_count bigint,
  court_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;

  return query
  select
    s.id,
    s.slug,
    s.name,
    s.icon,
    s.is_active,
    s.sort_order,
    count(c.id) filter (where c.is_active)::bigint,
    count(c.id)::bigint
  from public.sports s
  left join public.courts c on c.sport_id = s.id
  group by s.id, s.slug, s.name, s.icon, s.is_active, s.sort_order
  order by s.sort_order, s.name, s.id;
end;
$$;

create or replace function public.platform_admin_upsert_sport(
  p_sport_id uuid,
  p_slug text,
  p_name text,
  p_icon text,
  p_sort_order integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_icon text := nullif(trim(coalesce(p_icon, '')), '');
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;

  if v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
    raise exception 'invalid_sport_slug' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'invalid_sport_name' using errcode = '22023';
  end if;
  if v_icon is not null and char_length(v_icon) > 80 then
    raise exception 'invalid_sport_icon' using errcode = '22023';
  end if;
  if p_sort_order is null or p_sort_order < 0 or p_sort_order > 100000 then
    raise exception 'invalid_sport_sort_order' using errcode = '22023';
  end if;

  if p_sport_id is null then
    if exists (select 1 from public.sports s where s.slug = v_slug) then
      raise exception 'sport_slug_taken' using errcode = '23505';
    end if;

    insert into public.sports (slug, name, icon, sort_order, is_active)
    values (v_slug, v_name, v_icon, p_sort_order, true)
    returning id into v_id;
  else
    perform 1 from public.sports s where s.id = p_sport_id for update;
    if not found then
      raise exception 'sport_not_found' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.sports s where s.slug = v_slug and s.id <> p_sport_id) then
      raise exception 'sport_slug_taken' using errcode = '23505';
    end if;

    update public.sports
    set slug = v_slug,
        name = v_name,
        icon = v_icon,
        sort_order = p_sort_order,
        updated_at = now()
    where id = p_sport_id
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.platform_admin_set_sport_active(
  p_sport_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_sport public.sports%rowtype;
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;
  if p_sport_id is null or p_active is null then
    raise exception 'invalid_sport_state' using errcode = '22023';
  end if;

  select s.* into v_sport
  from public.sports s
  where s.id = p_sport_id
  for update;
  if not found then
    raise exception 'sport_not_found' using errcode = 'P0002';
  end if;

  if not p_active and exists (
    select 1 from public.courts c
    where c.sport_id = p_sport_id and c.is_active
  ) then
    raise exception 'sport_has_active_courts' using errcode = '23514';
  end if;

  update public.sports
  set is_active = p_active,
      updated_at = now()
  where id = p_sport_id;

  return true;
end;
$$;

revoke all on function public.get_public_sports() from public, anon, authenticated;
revoke all on function public.get_platform_admin_sports() from public, anon, authenticated;
revoke all on function public.platform_admin_upsert_sport(uuid,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.platform_admin_set_sport_active(uuid,boolean) from public, anon, authenticated;

grant execute on function public.get_public_sports() to anon, authenticated;
grant execute on function public.get_platform_admin_sports() to authenticated;
grant execute on function public.platform_admin_upsert_sport(uuid,text,text,text,integer) to authenticated;
grant execute on function public.platform_admin_set_sport_active(uuid,boolean) to authenticated;

revoke insert, update, delete on public.sports from anon, authenticated;

comment on function public.get_public_sports() is
  'B27: catálogo público de deportes activos, ordenado y sin datos sensibles.';
comment on function public.get_platform_admin_sports() is
  'B27: catálogo global completo con conteos de canchas; requiere ADMIN global.';
comment on function public.platform_admin_upsert_sport(uuid,text,text,text,integer) is
  'B27: crea o corrige deporte global; autorización derivada de is_platform_admin().';
comment on function public.platform_admin_set_sport_active(uuid,boolean) is
  'B27: activa/desactiva deporte global; no permite desactivar si aún tiene canchas activas.';
