-- Global Caxas | reparación del acceso al equipo y alta con clave temporal.
-- La invocación solo está otorgada a service_role (Edge Function autenticada).
-- No otorgar SELECT sobre auth.users a service_role ni acceso a anon/authenticated.
-- Las funciones SQL revisan el actor ADMIN y el business_id en cada ejecución.

-- Raíz del HTTP 503 del 13/11: service_role NO tiene SELECT sobre auth.users.
-- Ambas funciones lo consultaban como SECURITY INVOKER. Usan definidor protegido.
alter function public.platform_admin_team_attach(uuid,uuid,uuid,public.app_role,text)
  security definer;
alter function public.platform_admin_team_attach(uuid,uuid,uuid,public.app_role,text)
  set search_path = pg_catalog, public, auth, pg_temp;

alter function public.platform_admin_team_link_email(uuid,uuid,text,public.app_role,text)
  security definer;
alter function public.platform_admin_team_link_email(uuid,uuid,text,public.app_role,text)
  set search_path = pg_catalog, public, auth, pg_temp;

-- La cuenta creada con una contraseña provisional permanece inactiva: no puede
-- acceder a los RPC del panel hasta sustituirla desde el flujo de activación.
create or replace function public.platform_admin_team_attach_pending(
  p_actor_id uuid, p_business_id uuid, p_target_user_id uuid,
  p_role public.app_role, p_display_name text default null
)
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, public, auth, pg_temp as $$
declare
  v_name text := nullif(btrim(p_display_name),'');
  v_existing public.profiles%rowtype;
begin
  perform public.platform_admin_team_assert(p_actor_id,p_business_id);
  if p_target_user_id is null or p_role is null
    or (v_name is not null and char_length(v_name)>120)
    or not exists(select 1 from auth.users u where u.id=p_target_user_id)
  then
    raise exception 'team_invalid_input' using errcode='22023';
  end if;
  if exists(select 1 from public.user_accounts a
      where a.user_id=p_target_user_id and a.role='admin')
  then
    raise exception 'platform_admin_cannot_join_tenant' using errcode='42501';
  end if;
  if exists(select 1 from public.user_accounts a
      where a.user_id=p_target_user_id and not a.is_active)
  then
    raise exception 'existing_account_inactive' using errcode='42501';
  end if;
  perform 1 from public.businesses b where b.id=p_business_id for update;
  select * into v_existing from public.profiles p
    where p.user_id=p_target_user_id for update;
  if found then
    if v_existing.business_id<>p_business_id then
      raise exception 'user_assigned_elsewhere' using errcode='23505';
    end if;
    raise exception 'user_already_in_business' using errcode='23505';
  end if;
  insert into public.profiles(user_id,business_id,role,display_name,is_active)
  values(p_target_user_id,p_business_id,p_role,v_name,false);
  return jsonb_build_object('userId',p_target_user_id,
    'businessId',p_business_id,'role',p_role,'pendingActivation',true);
end;
$$;

-- Evita que desde el editor global alguien active una clave provisional antes
-- de que su titular la sustituya. La cuenta primaria sigue protegida.
create or replace function public.platform_admin_team_update(
  p_actor_id uuid, p_business_id uuid, p_target_user_id uuid,
  p_role public.app_role, p_is_active boolean,
  p_display_name text default null
)
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog, public, auth, pg_temp as $$
declare
  v_primary uuid;
  v_current public.profiles%rowtype;
  v_name text := nullif(btrim(p_display_name),'');
begin
  perform public.platform_admin_team_assert(p_actor_id,p_business_id);
  if p_role is null or p_is_active is null or p_target_user_id is null
    or (v_name is not null and char_length(v_name)>120)
  then
    raise exception 'team_invalid_input' using errcode='22023';
  end if;
  select b.owner_user_id into v_primary from public.businesses b
    where b.id=p_business_id for update;
  select * into v_current from public.profiles p
    where p.user_id=p_target_user_id and p.business_id=p_business_id for update;
  if not found then raise exception 'user_not_in_business' using errcode='P0002'; end if;
  if v_current.user_id=v_primary then
    raise exception 'primary_owner_transfer_required' using errcode='23514';
  end if;
  if exists(select 1 from public.user_accounts a
      where a.user_id=p_target_user_id and a.role='admin')
  then
    raise exception 'platform_admin_cannot_join_tenant' using errcode='42501';
  end if;
  if p_is_active and exists(select 1 from auth.users u
      where u.id=p_target_user_id
        and u.raw_app_meta_data->>'platform_tenant_temp'=p_business_id::text)
  then
    raise exception 'pending_password_activation' using errcode='23514';
  end if;
  update public.profiles p set role=p_role,is_active=p_is_active,
    display_name=v_name,updated_at=now()
    where p.user_id=p_target_user_id and p.business_id=p_business_id;
  if not exists(select 1 from public.profiles p
      where p.business_id=p_business_id and p.is_active and p.role='owner')
  then
    raise exception 'active_owner_required' using errcode='23514';
  end if;
  return jsonb_build_object('userId',p_target_user_id,
    'businessId',p_business_id,'role',p_role,'isActive',p_is_active);
end;
$$;

revoke all on function public.platform_admin_team_attach_pending(uuid,uuid,uuid,public.app_role,text)
  from public, anon, authenticated;
grant execute on function public.platform_admin_team_attach_pending(uuid,uuid,uuid,public.app_role,text)
  to service_role;

-- Comprobar también privilegios previos tras alterar sus definiciones.
revoke all on function public.platform_admin_team_attach(uuid,uuid,uuid,public.app_role,text)
  from public, anon, authenticated;
revoke all on function public.platform_admin_team_link_email(uuid,uuid,text,public.app_role,text)
  from public, anon, authenticated;
revoke all on function public.platform_admin_team_update(uuid,uuid,uuid,public.app_role,boolean,text)
  from public, anon, authenticated;
grant execute on function public.platform_admin_team_attach(uuid,uuid,uuid,public.app_role,text)
  to service_role;
grant execute on function public.platform_admin_team_link_email(uuid,uuid,text,public.app_role,text)
  to service_role;
grant execute on function public.platform_admin_team_update(uuid,uuid,uuid,public.app_role,boolean,text)
  to service_role;
