-- Bloque 36 · recuperación extraordinaria del propietario principal.
-- Superficie exclusiva del ADMIN global para recuperar un tenant huérfano o inaccesible.

create or replace function public.platform_admin_recover_primary_owner(
  p_business_id uuid,
  p_owner_email text
)
returns table (
  business_id uuid,
  previous_owner_user_id uuid,
  owner_user_id uuid
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_target_profile public.profiles%rowtype;
  v_target_account public.user_accounts%rowtype;
  v_owner_user_id uuid;
  v_owner_email text := lower(btrim(coalesce(p_owner_email, '')));
  v_owner_can_activate boolean := false;
  v_previous_owner_user_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'platform_admin_access_denied' using errcode = '42501';
  end if;
  if p_business_id is null then
    raise exception 'invalid_business_id' using errcode = '22023';
  end if;
  if v_owner_email = ''
     or char_length(v_owner_email) > 254
     or v_owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'invalid_owner_email' using errcode = '22023';
  end if;

  select u.id, (u.email_confirmed_at is not null or u.invited_at is not null)
  into v_owner_user_id, v_owner_can_activate
  from auth.users u
  where lower(u.email) = v_owner_email
  limit 1;

  if v_owner_user_id is null then
    raise exception 'owner_account_not_found' using errcode = 'P0002';
  end if;
  if not v_owner_can_activate then
    raise exception 'owner_account_unconfirmed' using errcode = '23514';
  end if;

  -- Mantiene el mismo orden de locks de B21: perfiles del tenant -> business -> cuenta target.
  perform 1
  from public.profiles p
  where p.business_id = p_business_id
  for update;

  select b.* into v_business
  from public.businesses b
  where b.id = p_business_id
  for update;

  if not found then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  v_previous_owner_user_id := v_business.owner_user_id;

  insert into public.user_accounts (user_id, role, is_active)
  values (v_owner_user_id, 'customer', true)
  on conflict (user_id) do nothing;

  select ua.* into v_target_account
  from public.user_accounts ua
  where ua.user_id = v_owner_user_id
  for update;

  if not found then
    raise exception 'owner_account_not_found' using errcode = 'P0002';
  end if;
  if not v_target_account.is_active then
    raise exception 'owner_account_inactive' using errcode = '23514';
  end if;
  if v_target_account.role = 'admin' then
    raise exception 'platform_admin_cannot_be_tenant_owner' using errcode = '23514';
  end if;

  select p.* into v_target_profile
  from public.profiles p
  where p.user_id = v_owner_user_id
  for update;

  if found and v_target_profile.business_id <> p_business_id then
    raise exception 'owner_already_assigned' using errcode = '23505';
  end if;
  if exists (
    select 1
    from public.businesses b
    where b.owner_user_id = v_owner_user_id
      and b.id <> p_business_id
  ) then
    raise exception 'owner_already_assigned' using errcode = '23505';
  end if;

  if found then
    update public.profiles p
    set role = 'owner',
        is_active = true,
        updated_at = now()
    where p.user_id = v_owner_user_id
      and p.business_id = p_business_id;
  else
    insert into public.profiles (user_id, business_id, role, display_name, is_active)
    values (v_owner_user_id, p_business_id, 'owner', null, true);
  end if;

  update public.user_accounts
  set role = 'owner',
      is_active = true,
      updated_at = now()
  where user_id = v_owner_user_id;

  if v_previous_owner_user_id is not null
     and v_previous_owner_user_id <> v_owner_user_id then
    update public.profiles p
    set is_active = false,
        updated_at = now()
    where p.user_id = v_previous_owner_user_id
      and p.business_id = p_business_id;
  end if;

  update public.businesses
  set owner_user_id = v_owner_user_id,
      updated_at = now()
  where id = p_business_id;

  return query
  select p_business_id, v_previous_owner_user_id, v_owner_user_id;
end;
$$;

revoke all on function public.platform_admin_recover_primary_owner(uuid,text)
  from public, anon;
grant execute on function public.platform_admin_recover_primary_owner(uuid,text)
  to authenticated;

comment on function public.platform_admin_recover_primary_owner(uuid,text) is
  'B36: recuperación extraordinaria de owner principal por ADMIN global. Resuelve por email, conserva aislamiento mono-tenant, desactiva el perfil tenant del principal anterior y nunca permite ADMIN global como owner.';

