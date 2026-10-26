-- Bloque 38 · perfil propio de cliente y autocompletado seguro.

create or replace function public.get_my_customer_profile()
returns table (
  display_name text,
  phone_e164 text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select ua.display_name, ua.phone_e164
  from public.user_accounts ua
  where ua.user_id = (select auth.uid())
    and ua.is_active
  limit 1;
$$;

create or replace function public.update_my_customer_profile(
  p_display_name text,
  p_phone_e164 text
)
returns table (
  display_name text,
  phone_e164 text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text := regexp_replace(trim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
  v_phone_e164 text := nullif(trim(coalesce(p_phone_e164, '')), '');
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(v_display_name) < 2 or char_length(v_display_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;
  if v_phone_e164 is not null and v_phone_e164 !~ '^[+][1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone_e164' using errcode = '22023';
  end if;

  update public.user_accounts ua
  set display_name = v_display_name,
      phone_e164 = v_phone_e164,
      updated_at = now()
  where ua.user_id = v_user_id
    and ua.is_active;

  if not found then
    raise exception 'customer_account_inactive' using errcode = '42501';
  end if;

  return query
  select ua.display_name, ua.phone_e164
  from public.user_accounts ua
  where ua.user_id = v_user_id;
end;
$$;

revoke all on function public.get_my_customer_profile() from public, anon;
grant execute on function public.get_my_customer_profile() to authenticated;
revoke all on function public.update_my_customer_profile(text,text) from public, anon;
grant execute on function public.update_my_customer_profile(text,text) to authenticated;

comment on function public.get_my_customer_profile() is
  'B38: devuelve únicamente display_name y phone_e164 de auth.uid() activo.';
comment on function public.update_my_customer_profile(text,text) is
  'B38: actualiza únicamente datos básicos propios; no acepta user_id, role, is_active ni business_id.';

