-- Bloque 34 · vinculación segura de cuentas existentes al acceso de un tenant.
-- La Edge Function usa service_role; el navegador nunca puede ejecutar esta RPC directamente.

create or replace function public.admin_access_link_existing_profile(
  p_actor_user_id uuid,
  p_existing_email text,
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
  v_account public.user_accounts%rowtype;
  v_target_user_id uuid;
  v_email text;
  v_display_name text;
  v_email_confirmed boolean;
begin
  if p_actor_user_id is null or p_role is null then
    raise exception 'invalid_admin_access_input' using errcode = '22023';
  end if;

  v_email := lower(btrim(coalesce(p_existing_email, '')));
  v_display_name := nullif(btrim(p_display_name), '');
  if v_email = '' or char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_admin_access_input' using errcode = '22023';
  end if;
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

  select u.id, (u.email_confirmed_at is not null)
  into v_target_user_id, v_email_confirmed
  from auth.users u
  where lower(u.email) = v_email
  limit 1;

  if v_target_user_id is null then
    raise exception 'existing_account_not_found' using errcode = 'P0002';
  end if;

  -- Serializa la identidad objetivo con las guardias ADMIN-global/OWNER de B21.
  perform pg_advisory_xact_lock(hashtext(v_target_user_id::text));

  if not v_email_confirmed then
    raise exception 'existing_account_unconfirmed' using errcode = '23514';
  end if;

  insert into public.user_accounts (user_id, role, is_active)
  values (v_target_user_id, 'customer', true)
  on conflict (user_id) do nothing;

  select ua.* into v_account
  from public.user_accounts ua
  where ua.user_id = v_target_user_id
  for update;

  if not found or not v_account.is_active then
    raise exception 'existing_account_inactive' using errcode = '23514';
  end if;
  if v_account.role = 'admin' then
    raise exception 'platform_admin_cannot_join_tenant' using errcode = '23514';
  end if;

  select p.* into v_existing
  from public.profiles p
  where p.user_id = v_target_user_id
  for update;

  if found and v_existing.business_id <> v_actor.business_id then
    raise exception 'user_assigned_elsewhere' using errcode = '42501';
  end if;
  if found then
    raise exception 'user_already_in_business' using errcode = '23505';
  end if;

  insert into public.profiles (user_id, business_id, role, display_name, is_active)
  values (v_target_user_id, v_actor.business_id, p_role, v_display_name, true);

  return query
  select p.user_id, p.business_id, p.role, p.display_name, p.is_active, p.created_at, p.updated_at
  from public.profiles p
  where p.user_id = v_target_user_id
    and p.business_id = v_actor.business_id;
end;
$$;

revoke all on function public.admin_access_link_existing_profile(uuid,text,public.app_role,text)
  from public, anon, authenticated;
grant execute on function public.admin_access_link_existing_profile(uuid,text,public.app_role,text)
  to service_role;

comment on function public.admin_access_link_existing_profile(uuid,text,public.app_role,text) is
  'B34 Edge-only: vincula una cuenta Auth existente y confirmada al tenant del OWNER, sin permitir cross-tenant ni ADMIN global.';

