-- Global ADMIN may provision tenant personnel through a server-only Edge Function.
-- Never grants global ADMIN privileges, and never gives the browser service_role.
-- All functions explicitly verify the actor and exact business even though the
-- privileged Edge Function invokes them with service_role.
create or replace function public.platform_admin_team_assert(p_actor_id uuid, p_business_id uuid)
returns boolean language plpgsql stable security invoker
set search_path = public, auth, pg_temp as $$
begin
  if p_actor_id is null or p_business_id is null
    or not exists (
      select 1 from public.user_accounts a
      where a.user_id = p_actor_id and a.role = 'admin' and a.is_active
    )
    or not exists (
      select 1 from public.businesses b where b.id = p_business_id and b.is_active
    )
  then
    raise exception 'platform_admin_team_access_denied' using errcode = '42501';
  end if;
  return true;
end;
$$;

create or replace function public.platform_admin_team_attach(
  p_actor_id uuid, p_business_id uuid, p_target_user_id uuid,
  p_role public.app_role, p_display_name text default null
)
returns jsonb language plpgsql volatile security invoker
set search_path = public, auth, pg_temp as $$
declare
  v_name text := nullif(btrim(p_display_name), '');
  v_profile public.profiles%rowtype;
begin
  perform public.platform_admin_team_assert(p_actor_id,p_business_id);
  if p_target_user_id is null or p_role is null or (v_name is not null and char_length(v_name) > 120)
    or not exists (select 1 from auth.users u where u.id = p_target_user_id)
  then
    raise exception 'team_invalid_input' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_accounts a where a.user_id = p_target_user_id and a.role='admin') then
    raise exception 'platform_admin_cannot_join_tenant' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_accounts a where a.user_id = p_target_user_id and not a.is_active) then
    raise exception 'existing_account_inactive' using errcode = '42501';
  end if;
  perform 1 from public.businesses b where b.id=p_business_id for update;
  select * into v_profile from public.profiles p where p.user_id=p_target_user_id for update;
  if found then
    if v_profile.business_id <> p_business_id then
      raise exception 'user_assigned_elsewhere' using errcode = '23505';
    end if;
    raise exception 'user_already_in_business' using errcode = '23505';
  end if;
  insert into public.profiles (user_id,business_id,role,display_name,is_active)
  values (p_target_user_id,p_business_id,p_role,v_name,true);
  return jsonb_build_object('userId',p_target_user_id,'businessId',p_business_id,'role',p_role);
end;
$$;

create or replace function public.platform_admin_team_link_email(
  p_actor_id uuid, p_business_id uuid, p_email text,
  p_role public.app_role, p_display_name text default null
)
returns jsonb language plpgsql volatile security invoker
set search_path = public, auth, pg_temp as $$
declare
  v_target auth.users%rowtype;
begin
  perform public.platform_admin_team_assert(p_actor_id,p_business_id);
  if p_email is null or char_length(p_email)>254 or position('@' in p_email)<2 then
    raise exception 'team_invalid_email' using errcode='22023';
  end if;
  select * into v_target from auth.users u where lower(u.email)=lower(btrim(p_email)) order by created_at limit 1;
  if not found then
    raise exception 'existing_account_not_found' using errcode='P0002';
  end if;
  if v_target.email_confirmed_at is null then
    raise exception 'existing_account_unconfirmed' using errcode='23514';
  end if;
  return public.platform_admin_team_attach(p_actor_id,p_business_id,v_target.id,p_role,p_display_name);
end;
$$;

create or replace function public.platform_admin_team_update(
  p_actor_id uuid, p_business_id uuid, p_target_user_id uuid,
  p_role public.app_role, p_is_active boolean,
  p_display_name text default null
)
returns jsonb language plpgsql volatile security invoker
set search_path = public, auth, pg_temp as $$
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
  select b.owner_user_id into v_primary
  from public.businesses b where b.id=p_business_id for update;
  select * into v_current from public.profiles p
    where p.user_id=p_target_user_id and p.business_id=p_business_id for update;
  if not found then raise exception 'user_not_in_business' using errcode='P0002'; end if;
  if v_current.user_id = v_primary then
    raise exception 'primary_owner_transfer_required' using errcode='23514';
  end if;
  if exists(select 1 from public.user_accounts a where a.user_id=p_target_user_id and a.role='admin') then
    raise exception 'platform_admin_cannot_join_tenant' using errcode='42501';
  end if;
  update public.profiles p set role=p_role,is_active=p_is_active,
      display_name=v_name,updated_at=now()
    where p.user_id=p_target_user_id and p.business_id=p_business_id;
  if not exists(select 1 from public.profiles p
      where p.business_id=p_business_id and p.is_active and p.role='owner') then
    raise exception 'active_owner_required' using errcode='23514';
  end if;
  return jsonb_build_object('userId',p_target_user_id,'businessId',p_business_id,
     'role',p_role,'isActive',p_is_active);
end;
$$;

revoke all on function public.platform_admin_team_assert(uuid,uuid) from public,anon,authenticated;
revoke all on function public.platform_admin_team_attach(uuid,uuid,uuid,public.app_role,text) from public,anon,authenticated;
revoke all on function public.platform_admin_team_link_email(uuid,uuid,text,public.app_role,text) from public,anon,authenticated;
revoke all on function public.platform_admin_team_update(uuid,uuid,uuid,public.app_role,boolean,text) from public,anon,authenticated;
grant execute on function public.platform_admin_team_assert(uuid,uuid) to service_role;
grant execute on function public.platform_admin_team_attach(uuid,uuid,uuid,public.app_role,text) to service_role;
grant execute on function public.platform_admin_team_link_email(uuid,uuid,text,public.app_role,text) to service_role;
grant execute on function public.platform_admin_team_update(uuid,uuid,uuid,public.app_role,boolean,text) to service_role;
