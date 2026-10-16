-- Valeibol Â· gestiÃ³n segura de usuarios administrativos.
-- Las mutaciones de perfiles de acceso son invocadas Ãºnicamente por la Edge Function
-- con service_role/secret key. El navegador nunca recibe esa credencial.

create or replace function public.admin_access_create_invited_profile(
  p_actor_user_id uuid,
  p_invited_user_id uuid,
  p_role public.app_role,
  p_display_name text default null
)
returns table (
  user_id uuid,
  business_id uuid,
  role public.app_role,
  display_name text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_existing public.profiles%rowtype;
  v_display_name text;
begin
  if p_actor_user_id is null or p_invited_user_id is null or p_role is null then
    raise exception 'invalid_admin_access_input' using errcode = '22023';
  end if;

  v_display_name := nullif(btrim(p_display_name), '');
  if v_display_name is not null and char_length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  select p.* into v_actor
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where p.user_id = p_actor_user_id
    and p.is_active
    and p.role = 'owner'
    and b.is_active
  for share of p;

  if not found then
    raise exception 'admin_owner_required' using errcode = '42501';
  end if;

  select p.* into v_existing
  from public.profiles p
  where p.user_id = p_invited_user_id
  for update;

  if found and v_existing.business_id <> v_actor.business_id then
    raise exception 'user_assigned_elsewhere' using errcode = '42501';
  end if;

  if found then
    update public.profiles p
    set role = p_role,
        display_name = v_display_name,
        is_active = true,
        updated_at = now()
    where p.user_id = p_invited_user_id;
  else
    insert into public.profiles (user_id, business_id, role, display_name, is_active)
    values (p_invited_user_id, v_actor.business_id, p_role, v_display_name, true);
  end if;

  return query
  select p.user_id, p.business_id, p.role, p.display_name, p.is_active, p.created_at, p.updated_at
  from public.profiles p
  where p.user_id = p_invited_user_id
    and p.business_id = v_actor.business_id;
end;
$$;

create or replace function public.admin_access_update_profile(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_role public.app_role default null,
  p_display_name text default null,
  p_display_name_provided boolean default false,
  p_is_active boolean default null
)
returns table (
  user_id uuid,
  business_id uuid,
  role public.app_role,
  display_name text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_next_role public.app_role;
  v_next_display_name text;
  v_next_is_active boolean;
  v_active_owner_count integer;
begin
  if p_actor_user_id is null or p_target_user_id is null then
    raise exception 'invalid_admin_access_input' using errcode = '22023';
  end if;

  select p.* into v_actor
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where p.user_id = p_actor_user_id
    and p.is_active
    and p.role = 'owner'
    and b.is_active
  for share of p;

  if not found then
    raise exception 'admin_owner_required' using errcode = '42501';
  end if;

  -- Serializa cambios de acceso del negocio para que dos owners no puedan
  -- degradarse/desactivarse concurrentemente y dejar el negocio sin owner activo.
  perform 1
  from public.profiles p
  where p.business_id = v_actor.business_id
  for update;

  select p.* into v_target
  from public.profiles p
  where p.user_id = p_target_user_id
    and p.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'user_not_in_business' using errcode = 'P0002';
  end if;

  v_next_role := coalesce(p_role, v_target.role);
  v_next_is_active := coalesce(p_is_active, v_target.is_active);
  v_next_display_name := case
    when p_display_name_provided then nullif(btrim(p_display_name), '')
    else v_target.display_name
  end;

  if p_target_user_id = p_actor_user_id
     and (v_next_role <> 'owner' or not v_next_is_active) then
    raise exception 'cannot_change_own_access' using errcode = '23514';
  end if;

  if v_next_display_name is not null and char_length(v_next_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;

  update public.profiles p
  set role = v_next_role,
      display_name = v_next_display_name,
      is_active = v_next_is_active,
      updated_at = now()
  where p.user_id = p_target_user_id
    and p.business_id = v_actor.business_id;

  select count(*)::integer into v_active_owner_count
  from public.profiles p
  where p.business_id = v_actor.business_id
    and p.is_active
    and p.role = 'owner';

  if v_active_owner_count < 1 then
    raise exception 'active_owner_required' using errcode = '23514';
  end if;

  return query
  select p.user_id, p.business_id, p.role, p.display_name, p.is_active, p.created_at, p.updated_at
  from public.profiles p
  where p.user_id = p_target_user_id
    and p.business_id = v_actor.business_id;
end;
$$;

revoke all on function public.admin_access_create_invited_profile(uuid, uuid, public.app_role, text)
  from public, anon, authenticated;
revoke all on function public.admin_access_update_profile(uuid, uuid, public.app_role, text, boolean, boolean)
  from public, anon, authenticated;

grant execute on function public.admin_access_create_invited_profile(uuid, uuid, public.app_role, text)
  to service_role;
grant execute on function public.admin_access_update_profile(uuid, uuid, public.app_role, text, boolean, boolean)
  to service_role;

comment on function public.admin_access_create_invited_profile(uuid, uuid, public.app_role, text) is
  'Edge-only: asigna a un usuario invitado al negocio del owner autenticado y activa su perfil.';
comment on function public.admin_access_update_profile(uuid, uuid, public.app_role, text, boolean, boolean) is
  'Edge-only: actualiza rol/nombre/estado dentro del negocio y conserva al menos un owner activo.';

