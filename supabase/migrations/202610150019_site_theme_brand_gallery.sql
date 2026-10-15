-- Valeibol · identidad visual administrable + fotografías reales del local.
-- Mantiene el acceso directo a la tabla revocado y expone únicamente RPCs acotadas.

alter table public.business_site_content
  add column if not exists theme jsonb not null default
  '{"presetId":"classic","navy":"#0C2B4A","blue":"#155FA8","blueDark":"#0F4B88","red":"#B72F34","redDark":"#92252A","yellow":"#F4C430","canvas":"#F3F7FB"}'::jsonb;

alter table public.business_site_content
  drop constraint if exists business_site_content_theme_object;
alter table public.business_site_content
  add constraint business_site_content_theme_object
  check (jsonb_typeof(theme) = 'object');

-- Las dos fotografías proporcionadas por el negocio pasan a ser la galería inicial real.
update public.business_site_content c
set
  gallery = '[
    {"id":"valeibol-wide","title":"Vista de la cancha","imageUrl":"/images/valeibol-court-wide.webp","altText":"Vista amplia de las instalaciones de mi valeibol","sortOrder":10,"isVisible":true},
    {"id":"valeibol-portrait","title":"Zona de juego","imageUrl":"/images/valeibol-court-portrait.webp","altText":"Vista de la cancha y la red de mi valeibol","sortOrder":20,"isVisible":true}
  ]'::jsonb,
  updated_at = now()
from public.businesses b
where c.business_id = b.id
  and b.slug = 'valeibol-cajamarca'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(c.gallery, '[]'::jsonb)) item
    where nullif(btrim(item->>'imageUrl'), '') is not null
  );

drop function if exists public.get_public_site_content(text);
create function public.get_public_site_content(p_business_slug text)
returns table (
  business_id uuid,
  services jsonb,
  gallery jsonb,
  theme jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    coalesce((
      select jsonb_agg(item order by coalesce((item->>'sortOrder')::integer, 0))
      from jsonb_array_elements(coalesce(c.services, '[]'::jsonb)) item
      where coalesce((item->>'isVisible')::boolean, true)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(item order by coalesce((item->>'sortOrder')::integer, 0))
      from jsonb_array_elements(coalesce(c.gallery, '[]'::jsonb)) item
      where coalesce((item->>'isVisible')::boolean, true)
    ), '[]'::jsonb),
    coalesce(c.theme, '{"presetId":"classic","navy":"#0C2B4A","blue":"#155FA8","blueDark":"#0F4B88","red":"#B72F34","redDark":"#92252A","yellow":"#F4C430","canvas":"#F3F7FB"}'::jsonb),
    c.updated_at
  from public.businesses b
  left join public.business_site_content c on c.business_id = b.id
  where b.slug = p_business_slug and b.is_active
  limit 1;
$$;

drop function if exists public.get_admin_site_content();
create function public.get_admin_site_content()
returns table (
  business_id uuid,
  services jsonb,
  gallery jsonb,
  theme jsonb,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  return query
  select
    v_actor.business_id,
    coalesce(c.services, '[]'::jsonb),
    coalesce(c.gallery, '[]'::jsonb),
    coalesce(c.theme, '{"presetId":"classic","navy":"#0C2B4A","blue":"#155FA8","blueDark":"#0F4B88","red":"#B72F34","redDark":"#92252A","yellow":"#F4C430","canvas":"#F3F7FB"}'::jsonb),
    c.updated_at
  from (select 1) seed
  left join public.business_site_content c on c.business_id = v_actor.business_id;
end;
$$;

drop function if exists public.admin_update_site_content(jsonb, jsonb);
drop function if exists public.admin_update_site_content(jsonb, jsonb, jsonb);
create function public.admin_update_site_content(
  p_services jsonb,
  p_gallery jsonb,
  p_theme jsonb
)
returns table (
  business_id uuid,
  services jsonb,
  gallery jsonb,
  theme jsonb,
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
  if p_theme is null or jsonb_typeof(p_theme) <> 'object'
    or coalesce(p_theme->>'presetId', '') not in ('classic', 'competitive', 'night', 'custom')
    or coalesce(p_theme->>'navy', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'blue', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'blueDark', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'red', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'redDark', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'yellow', '') !~ '^#[0-9A-Fa-f]{6}$'
    or coalesce(p_theme->>'canvas', '') !~ '^#[0-9A-Fa-f]{6}$'
  then
    raise exception 'invalid_theme' using errcode = '22023';
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
      or (
        nullif(btrim(item->>'imageUrl'), '') is not null
        and btrim(item->>'imageUrl') !~* '^https?://'
        and btrim(item->>'imageUrl') !~ '^/images/[A-Za-z0-9._/-]+$'
      )
      or char_length(coalesce(item->>'altText', '')) > 180
  ) then
    raise exception 'invalid_gallery' using errcode = '22023';
  end if;

  insert into public.business_site_content (business_id, services, gallery, theme, updated_by, updated_at)
  values (v_actor.business_id, p_services, p_gallery, p_theme, v_actor.user_id, now())
  on conflict (business_id) do update set
    services = excluded.services,
    gallery = excluded.gallery,
    theme = excluded.theme,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into v_updated;

  return query
  select v_updated.business_id, v_updated.services, v_updated.gallery, v_updated.theme, v_updated.updated_at;
end;
$$;

revoke all on function public.get_public_site_content(text) from public;
grant execute on function public.get_public_site_content(text) to anon, authenticated;

revoke all on function public.get_admin_site_content() from public, anon, authenticated;
grant execute on function public.get_admin_site_content() to authenticated;

revoke all on function public.admin_update_site_content(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_update_site_content(jsonb, jsonb, jsonb) to authenticated;

revoke all on public.business_site_content from public, anon, authenticated;
