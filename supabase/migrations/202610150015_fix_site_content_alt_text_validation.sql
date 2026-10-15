-- Corrige validación de altText desplegada en la revisión anterior.

create or replace function public.admin_update_site_content(
  p_services jsonb,
  p_gallery jsonb
)
returns table (
  business_id uuid,
  services jsonb,
  gallery jsonb,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_updated public.business_site_content%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;
  if v_actor.role not in ('owner', 'admin') then
    raise exception 'insufficient_role' using errcode = '42501';
  end if;

  if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) > 24 then
    raise exception 'invalid_services' using errcode = '22023';
  end if;
  if p_gallery is null or jsonb_typeof(p_gallery) <> 'array' or jsonb_array_length(p_gallery) > 16 then
    raise exception 'invalid_gallery' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_services) item
    where jsonb_typeof(item) <> 'object'
      or nullif(btrim(item->>'id'), '') is null
      or char_length(item->>'id') > 80
      or nullif(btrim(item->>'title'), '') is null
      or char_length(item->>'title') > 80
      or nullif(btrim(item->>'description'), '') is null
      or char_length(item->>'description') > 220
      or char_length(coalesce(item->>'icon', '')) > 8
  ) then
    raise exception 'invalid_services' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_gallery) item
    where jsonb_typeof(item) <> 'object'
      or nullif(btrim(item->>'id'), '') is null
      or char_length(item->>'id') > 80
      or nullif(btrim(item->>'title'), '') is null
      or char_length(item->>'title') > 100
      or char_length(coalesce(item->>'imageUrl', '')) > 1200
      or (nullif(btrim(item->>'imageUrl'), '') is not null and btrim(item->>'imageUrl') !~* '^https?://')
      or char_length(coalesce(item->>'altText', '')) > 180
  ) then
    raise exception 'invalid_gallery' using errcode = '22023';
  end if;

  insert into public.business_site_content (business_id, services, gallery, updated_by, updated_at)
  values (v_actor.business_id, p_services, p_gallery, v_actor.user_id, now())
  on conflict (business_id) do update set
    services = excluded.services,
    gallery = excluded.gallery,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_updated;

  return query select v_updated.business_id, v_updated.services, v_updated.gallery, v_updated.updated_at;
end;
$$;

revoke all on function public.admin_update_site_content(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_site_content(jsonb, jsonb) to authenticated;
