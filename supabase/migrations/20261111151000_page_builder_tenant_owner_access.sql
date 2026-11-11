-- CAXAS: the studio may be used by the GLOBAL admin supervising a selected
-- tenant, or an active owner/manager of that exact tenant. Staff is read-only
-- and cannot access drafts, revisions or publishing operations.
create or replace function private.platform_page_builder_assert_actor(p_business_id uuid)
returns void language plpgsql stable security definer
set search_path = public, private, pg_temp
as $$
declare
  v_is_global boolean := coalesce(public.is_platform_admin(), false);
begin
  if auth.uid() is null
    or not exists (select 1 from public.businesses b where b.id = p_business_id and b.is_active)
    or not (
      (v_is_global and private.platform_admin_selected_business_id() is not distinct from p_business_id)
      or
      (not v_is_global and exists (
        select 1 from public.profiles p
        join public.businesses b on b.id = p.business_id
        where p.user_id = auth.uid()
          and p.business_id = p_business_id
          and p.role in ('owner', 'admin')
          and p.is_active
          and b.is_active
      ))
    )
  then
    raise exception 'page_builder_access_denied' using errcode = '42501';
  end if;
end;
$$;
revoke all on function private.platform_page_builder_assert_actor(uuid)
  from public, anon, authenticated;
