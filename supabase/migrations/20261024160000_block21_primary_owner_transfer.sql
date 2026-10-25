-- Bloque 21 · transferencia explícita del propietario principal.
-- Edge/service_role only: el navegador no puede ejecutar esta operación directamente.

create or replace function public.admin_access_transfer_primary_owner(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns table (
  business_id uuid,
  previous_owner_user_id uuid,
  owner_user_id uuid
)
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses%rowtype;
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_target_account public.user_accounts%rowtype;
begin
  if p_actor_user_id is null or p_target_user_id is null then
    raise exception 'invalid_owner_transfer_input' using errcode = '22023';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception 'cannot_transfer_owner_to_self' using errcode = '23514';
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
    raise exception 'primary_owner_required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles p
  where p.business_id = v_actor.business_id
  for update;

  select p.* into v_actor
  from public.profiles p
  where p.user_id = p_actor_user_id
    and p.business_id = v_actor.business_id
    and p.is_active
    and p.role = 'owner';

  if not found then
    raise exception 'primary_owner_required' using errcode = '42501';
  end if;

  select b.* into v_business
  from public.businesses b
  where b.id = v_actor.business_id
    and b.owner_user_id = p_actor_user_id
    and b.is_active
  for update;

  if not found then
    raise exception 'primary_owner_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = p_actor_user_id
      and ua.is_active
      and ua.role = 'owner'
  ) then
    raise exception 'primary_owner_required' using errcode = '42501';
  end if;

  select p.* into v_target
  from public.profiles p
  where p.user_id = p_target_user_id
    and p.business_id = v_business.id;

  if not found then
    raise exception 'ownership_target_not_found' using errcode = 'P0002';
  end if;
  if not v_target.is_active then
    raise exception 'ownership_target_inactive' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from auth.users u
    where u.id = p_target_user_id
      and u.email_confirmed_at is not null
  ) then
    raise exception 'ownership_target_unconfirmed' using errcode = '23514';
  end if;

  select ua.* into v_target_account
  from public.user_accounts ua
  where ua.user_id = p_target_user_id
  for update;

  if not found or not v_target_account.is_active then
    raise exception 'ownership_target_inactive' using errcode = '23514';
  end if;
  if v_target_account.role = 'admin' then
    raise exception 'platform_admin_cannot_be_tenant_owner' using errcode = '23514';
  end if;

  update public.profiles
  set role = 'owner',
      is_active = true,
      updated_at = now()
  where user_id = p_target_user_id
    and business_id = v_business.id;

  update public.user_accounts
  set role = 'owner',
      is_active = true,
      updated_at = now()
  where user_id = p_target_user_id;

  update public.businesses
  set owner_user_id = p_target_user_id,
      updated_at = now()
  where id = v_business.id;

  return query
  select v_business.id, p_actor_user_id, p_target_user_id;
end;
$$;

revoke all on function public.admin_access_transfer_primary_owner(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_access_transfer_primary_owner(uuid,uuid)
  to service_role;

comment on function public.admin_access_transfer_primary_owner(uuid,uuid) is
  'B21 Edge-only: transfiere owner_user_id al miembro activo/confirmado del mismo tenant; promueve target a owner y conserva al owner anterior como owner no principal.';

-- Invariante global: una identidad ADMIN global no puede coexistir como OWNER tenant.
create or replace function private.guard_profile_owner_not_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'owner' then
    -- Las tres rutas que pueden formar la invariante ADMIN/OWNER toman el mismo
    -- lock transaccional por usuario. Evita write-skew entre tablas distintas.
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  end if;
  if new.role = 'owner' and exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = new.user_id
      and ua.is_active
      and ua.role = 'admin'
  ) then
    raise exception 'platform_admin_cannot_be_tenant_owner' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_platform_admin_not_tenant_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'admin' and new.is_active then
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  end if;
  if new.role = 'admin' and new.is_active and (
    exists (
      select 1
      from public.profiles p
      where p.user_id = new.user_id
        and p.is_active
        and p.role = 'owner'
    )
    or exists (
      select 1
      from public.businesses b
      where b.owner_user_id = new.user_id
    )
  ) then
    raise exception 'tenant_owner_cannot_be_platform_admin' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.guard_business_primary_owner_not_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.owner_user_id is not null then
    perform pg_advisory_xact_lock(hashtext(new.owner_user_id::text));
  end if;
  if new.owner_user_id is not null and exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = new.owner_user_id
      and ua.is_active
      and ua.role = 'admin'
  ) then
    raise exception 'platform_admin_cannot_be_tenant_owner' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_profile_owner_not_platform_admin() from public, anon, authenticated;
revoke all on function private.guard_platform_admin_not_tenant_owner() from public, anon, authenticated;
revoke all on function private.guard_business_primary_owner_not_platform_admin() from public, anon, authenticated;

drop trigger if exists profiles_block_platform_admin_owner on public.profiles;
create trigger profiles_block_platform_admin_owner
before insert or update of role, user_id, is_active on public.profiles
for each row execute function private.guard_profile_owner_not_platform_admin();

drop trigger if exists user_accounts_block_tenant_owner_admin on public.user_accounts;
create trigger user_accounts_block_tenant_owner_admin
before insert or update of role, is_active on public.user_accounts
for each row execute function private.guard_platform_admin_not_tenant_owner();

drop trigger if exists businesses_block_platform_admin_primary_owner on public.businesses;
create trigger businesses_block_platform_admin_primary_owner
before insert or update of owner_user_id on public.businesses
for each row execute function private.guard_business_primary_owner_not_platform_admin();

do $$
begin
  if exists (
    select 1
    from public.user_accounts ua
    where ua.is_active
      and ua.role = 'admin'
      and (
        exists (
          select 1 from public.profiles p
          where p.user_id = ua.user_id and p.is_active and p.role = 'owner'
        )
        or exists (
          select 1 from public.businesses b where b.owner_user_id = ua.user_id
        )
      )
  ) then
    raise exception 'existing_platform_admin_tenant_owner_conflict' using errcode = '23514';
  end if;
end
$$;
