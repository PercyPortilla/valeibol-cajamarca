-- Valeibol · Contenido público administrable (servicios + galería)
-- El contenido comercial se guarda por negocio y solo owner/admin puede editarlo.

create table if not exists public.business_site_content (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  services jsonb not null default '[]'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  updated_by uuid null,
  updated_at timestamptz not null default now(),
  constraint business_site_content_services_array check (jsonb_typeof(services) = 'array' and jsonb_array_length(services) <= 24),
  constraint business_site_content_gallery_array check (jsonb_typeof(gallery) = 'array' and jsonb_array_length(gallery) <= 16)
);

alter table public.business_site_content enable row level security;
revoke all on public.business_site_content from public, anon, authenticated;

comment on table public.business_site_content is
  'Contenido comercial público administrable. Acceso únicamente mediante RPCs con scope de negocio.';

insert into public.business_site_content (business_id, services, gallery)
select
  b.id,
  '[
    {"id":"covered-court","icon":"⌂","title":"Cancha techada","description":"Espacio cubierto para jugar con mayor comodidad durante todo el turno.","sortOrder":10,"isVisible":true},
    {"id":"hourly-booking","icon":"◷","title":"Reserva por hora","description":"Elige un bloque disponible y organiza tu partido o entrenamiento.","sortOrder":20,"isVisible":true},
    {"id":"lighting","icon":"☼","title":"Iluminación opcional","description":"Juega de día o de noche con la tarifa correspondiente.","sortOrder":30,"isVisible":true},
    {"id":"cooling-break","icon":"❄","title":"Zona de cooling break","description":"Espacio para descansar e hidratarse entre sets o durante pausas del juego.","sortOrder":40,"isVisible":true},
    {"id":"music-choice","icon":"♫","title":"Música a elección","description":"Ambientación musical para acompañar tu turno de juego.","sortOrder":50,"isVisible":true},
    {"id":"tv-zone","icon":"▣","title":"Zona TV","description":"Área con TV para acompañantes y momentos de descanso.","sortOrder":60,"isVisible":true},
    {"id":"snack-store","icon":"▤","title":"Tienda de bebidas y snacks","description":"Bebidas y snacks disponibles para jugadores y acompañantes.","sortOrder":70,"isVisible":true},
    {"id":"restrooms","icon":"◉","title":"Baños para hombres y mujeres","description":"Servicios higiénicos diferenciados para mayor comodidad.","sortOrder":80,"isVisible":true},
    {"id":"changing-rooms","icon":"▥","title":"Vestidores","description":"Espacio para cambiarse antes o después del juego.","sortOrder":90,"isVisible":true},
    {"id":"spectator-zone","icon":"◎","title":"Zona para público","description":"Área destinada a acompañantes y espectadores.","sortOrder":100,"isVisible":true},
    {"id":"net-height","icon":"↕","title":"Altura de malla a elección","description":"Ajustamos la altura de la malla según el tipo de juego que necesites.","sortOrder":110,"isVisible":true},
    {"id":"pro-balls","icon":"◌","title":"Balones profesionales","description":"Balones de vóley profesionales disponibles para el turno.","sortOrder":120,"isVisible":true}
  ]'::jsonb,
  '[
    {"id":"gallery-1","title":"Vista general","imageUrl":"","altText":"Vista general de las instalaciones de Valeibol","sortOrder":10,"isVisible":true},
    {"id":"gallery-2","title":"Cancha","imageUrl":"","altText":"Cancha de vóley de Valeibol","sortOrder":20,"isVisible":true},
    {"id":"gallery-3","title":"Zona de juego","imageUrl":"","altText":"Red y zona de juego de Valeibol","sortOrder":30,"isVisible":true},
    {"id":"gallery-4","title":"Ingreso","imageUrl":"","altText":"Ingreso de Valeibol","sortOrder":40,"isVisible":true}
  ]'::jsonb
from public.businesses b
where b.slug = 'valeibol-cajamarca'
on conflict (business_id) do nothing;

create or replace function public.get_public_site_content(p_business_slug text)
returns table (
  business_id uuid,
  services jsonb,
  gallery jsonb,
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
    c.updated_at
  from public.businesses b
  left join public.business_site_content c on c.business_id = b.id
  where b.slug = p_business_slug and b.is_active
  limit 1;
$$;

create or replace function public.get_admin_site_content()
returns table (
  business_id uuid,
  services jsonb,
  gallery jsonb,
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
    c.updated_at
  from (select 1) seed
  left join public.business_site_content c on c.business_id = v_actor.business_id;
end;
$$;

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

revoke all on function public.get_public_site_content(text) from public;
grant execute on function public.get_public_site_content(text) to anon, authenticated;

revoke all on function public.get_admin_site_content() from public, anon, authenticated;
revoke all on function public.admin_update_site_content(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.get_admin_site_content() to authenticated;
grant execute on function public.admin_update_site_content(jsonb, jsonb) to authenticated;

-- Galería pública: las imágenes son contenido comercial público, pero solo owner/admin puede subir o borrar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-gallery',
  'business-gallery',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_gallery_admin_insert on storage.objects;
create policy business_gallery_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-gallery'
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.is_active
      and p.role in ('owner', 'admin')
      and split_part(name, '/', 1) = p.business_id::text
  )
);

drop policy if exists business_gallery_admin_update on storage.objects;
create policy business_gallery_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'business-gallery'
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.is_active
      and p.role in ('owner', 'admin')
      and split_part(name, '/', 1) = p.business_id::text
  )
)
with check (
  bucket_id = 'business-gallery'
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.is_active
      and p.role in ('owner', 'admin')
      and split_part(name, '/', 1) = p.business_id::text
  )
);

drop policy if exists business_gallery_admin_delete on storage.objects;
create policy business_gallery_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'business-gallery'
  and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.is_active
      and p.role in ('owner', 'admin')
      and split_part(name, '/', 1) = p.business_id::text
  )
);
