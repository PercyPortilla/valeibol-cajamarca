-- CAXAS B67: dos campos FÍSICOS, cada uno compatible con varios deportes.
-- Un solo court_id por campo mantiene UNA agenda por espacio físico y evita dobles reservas.
-- No inventa tarifas, horarios ni reservas del nuevo Campo 2.
create table if not exists public.court_extra_sports (
  business_id uuid not null,
  court_id uuid not null,
  sport_id uuid not null references public.sports(id) on delete restrict,
  primary key (court_id, sport_id),
  foreign key (court_id, business_id) references public.courts(id, business_id) on delete cascade
);
create index if not exists court_extra_sports_business_idx on public.court_extra_sports(business_id, court_id);
alter table public.court_extra_sports enable row level security;
revoke all on public.court_extra_sports from public, anon, authenticated;

-- Campo no listo para reservas que el negocio eligió mostrar informativamente.
create table if not exists public.court_public_showcase (
  business_id uuid not null,
  court_id uuid primary key,
  is_visible boolean not null default false,
  foreign key (court_id, business_id) references public.courts(id, business_id) on delete cascade
);
create index if not exists court_public_showcase_business_idx on public.court_public_showcase(business_id);
alter table public.court_public_showcase enable row level security;
revoke all on public.court_public_showcase from public, anon, authenticated;

create or replace function public.admin_get_court_sport_settings(p_court_id uuid)
returns table (sport_id uuid, showcase_visible boolean)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_actor record;
begin
  select * into v_actor from public.phase6_admin_actor() limit 1;
  if v_actor.business_id is null or v_actor.role not in ('owner','admin')
     or not exists (select 1 from public.courts c where c.id=p_court_id and c.business_id=v_actor.business_id) then
    raise exception 'tenant_access_denied' using errcode='42501';
  end if;
  return query
    select x.sport_id, coalesce(sh.is_visible,false)
    from public.courts c
    left join public.court_extra_sports x on x.court_id=c.id and x.business_id=c.business_id
    left join public.court_public_showcase sh on sh.court_id=c.id and sh.business_id=c.business_id
    where c.id=p_court_id and c.business_id=v_actor.business_id;
end;
$$;

create or replace function public.admin_set_court_extra_sports(p_court_id uuid, p_sport_ids uuid[])
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_actor record; v_primary uuid; v_count integer;
begin
  select * into v_actor from public.phase6_admin_actor() limit 1;
  if v_actor.business_id is null or v_actor.role not in ('owner','admin') then
    raise exception 'tenant_access_denied' using errcode='42501';
  end if;
  select c.sport_id into v_primary from public.courts c
    where c.id=p_court_id and c.business_id=v_actor.business_id for update;
  if v_primary is null or p_sport_ids is null then
    raise exception 'invalid_court_sports' using errcode='22023';
  end if;
  if cardinality(p_sport_ids)>20 or array_position(p_sport_ids,null) is not null then
    raise exception 'invalid_court_sports' using errcode='22023';
  end if;
  select count(*) into v_count from (select distinct unnest(p_sport_ids) as id) x
    join public.sports s on s.id=x.id and s.is_active
    where x.id<>v_primary;
  if v_count<>coalesce((select count(distinct requested.sport_id) from unnest(p_sport_ids) as requested(sport_id)
      where requested.sport_id<>v_primary),0) then
    raise exception 'invalid_court_sports' using errcode='22023';
  end if;
  delete from public.court_extra_sports where court_id=p_court_id and business_id=v_actor.business_id;
  insert into public.court_extra_sports(business_id,court_id,sport_id)
    select v_actor.business_id,p_court_id,x.id
    from (select distinct unnest(p_sport_ids) as id) x
    where x.id<>v_primary;
end;
$$;

create or replace function public.admin_set_court_showcase(p_court_id uuid,p_visible boolean)
returns void language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_actor record;
begin
  select * into v_actor from public.phase6_admin_actor() limit 1;
  if v_actor.business_id is null or v_actor.role not in ('owner','admin') or p_visible is null then
    raise exception 'tenant_access_denied' using errcode='42501';
  end if;
  if not exists(select 1 from public.courts c where c.id=p_court_id and c.business_id=v_actor.business_id) then
    raise exception 'tenant_access_denied' using errcode='42501';
  end if;
  insert into public.court_public_showcase(business_id,court_id,is_visible)
    values(v_actor.business_id,p_court_id,p_visible)
    on conflict(court_id) do update set is_visible=excluded.is_visible;
end;
$$;

create or replace function public.admin_update_court_sport_settings(
  p_court_id uuid,p_sport_ids uuid[],p_visible boolean
)
returns void language plpgsql security invoker
set search_path=public,pg_temp
as $$
begin
  perform public.admin_set_court_extra_sports(p_court_id,p_sport_ids);
  perform public.admin_set_court_showcase(p_court_id,p_visible);
end;
$$;

-- La ficha pública incluye únicamente los campos marcados expresamente para exhibición,
-- incluso si están pendientes de horario. No muestra reservas, empleados ni datos privados.
create or replace function public.get_public_business_showcase(p_business_slug text)
returns table (
  venue_id uuid, court_id uuid, court_slug text, court_name text,
  is_bookable boolean, sports jsonb, price_from numeric, currency text
)
language sql stable security definer
set search_path=public,pg_temp
as $$
  select v.id,c.id,c.slug,c.name,
    (
      c.is_active and c.configuration_status='confirmed'
      and exists (
        select 1 from public.operating_hours h
        where h.court_id=c.id and h.is_open and h.configuration_status='confirmed'
          and h.effective_from<=((now() at time zone b.timezone)::date)
          and (h.effective_until is null or h.effective_until>=((now() at time zone b.timezone)::date))
      )
      and (
        select count(distinct r.lighting) from public.pricing_rules r
        where r.court_id=c.id and r.is_active
          and r.effective_from<=((now() at time zone b.timezone)::date)
          and (r.effective_until is null or r.effective_until>=((now() at time zone b.timezone)::date))
      )=2
    ) as is_bookable,
    sports.list,rates.price_from,b.currency
  from public.businesses b
  join public.venues v on v.business_id=b.id and v.is_active
  join public.courts c on c.venue_id=v.id and c.business_id=b.id
  join public.court_public_showcase sh on sh.court_id=c.id and sh.business_id=b.id and sh.is_visible
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name) order by s.sort_order,s.name),'[]'::jsonb) list
    from public.sports s where s.is_active and
      (s.id=c.sport_id or exists(select 1 from public.court_extra_sports x where x.court_id=c.id and x.sport_id=s.id))
  ) sports
  left join lateral (
    select min(r.hourly_rate) price_from from public.pricing_rules r
    where r.court_id=c.id and r.is_active
      and r.effective_from<=((now() at time zone b.timezone)::date)
      and (r.effective_until is null or r.effective_until>=((now() at time zone b.timezone)::date))
  ) rates on true
  where b.slug=p_business_slug and b.is_active and b.configuration_status='confirmed'
  order by v.sort_order,c.sort_order,c.name;
$$;

-- El catálogo global sigue devolviendo UNA fila por combinación campo/deporte
-- y UNA única court_id compartida. Conteos de campos y reservas no se duplican.
create or replace function public.get_public_platform_catalog(
  p_sport_slug text default null,
  p_city text default null
)
returns table (
  business_id uuid, business_slug text, business_name text, business_city text,
  business_country text, business_timezone text, logo_url text, cover_image_url text,
  cover_alt_text text, rating_average numeric, review_count bigint,
  venue_id uuid, venue_slug text, venue_name text, venue_city text,
  venue_address text, latitude numeric, longitude numeric, court_id uuid,
  court_slug text, court_name text, court_surface text, sport_id uuid,
  sport_slug text, sport_name text, price_from numeric, currency text
)
language sql stable security definer set search_path=public,pg_temp
as $$
  with reputation as (
    select rv.business_id,round(avg(rv.rating)::numeric,1) rating_average,count(*)::bigint review_count
    from public.business_reviews rv where rv.status='published' group by rv.business_id
  )
  select
    b.id,b.slug,b.name,b.city,b.country,b.timezone,
    site_content.logo_url,cover.image_url,cover.alt_text,rep.rating_average,coalesce(rep.review_count,0)::bigint,
    v.id,v.slug,v.name,v.city,v.address,v.latitude,v.longitude,
    c.id,c.slug,c.name,c.surface,s.id,s.slug,s.name,rates.price_from,b.currency
  from public.businesses b
  join public.venues v on v.business_id=b.id and v.is_active
  join public.courts c on c.business_id=b.id and c.venue_id=v.id and c.is_active
  join public.sports s on s.is_active and (
    s.id=c.sport_id or exists(select 1 from public.court_extra_sports x where x.court_id=c.id and x.sport_id=s.id)
  )
  left join public.business_site_content site_content on site_content.business_id=b.id
  left join lateral (
    select nullif(btrim(item->>'imageUrl'),'') image_url,nullif(btrim(item->>'altText'),'') alt_text
    from jsonb_array_elements(coalesce(site_content.gallery,'[]'::jsonb)) item
    where lower(coalesce(item->>'isVisible','true')) not in ('false','f','no','n','0','off')
      and nullif(btrim(item->>'imageUrl'),'') is not null
    order by case when coalesce(item->>'sortOrder','')~'^[0-9]{1,4}$' then (item->>'sortOrder')::integer else 0 end,
      coalesce(item->>'id','') limit 1
  ) cover on true
  left join reputation rep on rep.business_id=b.id
  left join lateral (
    select min(pr.hourly_rate) price_from from public.pricing_rules pr
    where pr.court_id=c.id and pr.is_active
      and ((now() at time zone b.timezone)::date)>=pr.effective_from
      and (pr.effective_until is null or ((now() at time zone b.timezone)::date)<=pr.effective_until)
  ) rates on true
  where b.is_active and b.configuration_status='confirmed'
    and lower(coalesce(v.city,b.city,''))='cajamarca'
    and (p_city is null or lower(trim(p_city))='cajamarca')
    and (p_sport_slug is null or s.slug=p_sport_slug)
  order by b.name,v.sort_order,v.name,c.sort_order,c.name,s.sort_order,s.name;
$$;

revoke all on function public.admin_get_court_sport_settings(uuid) from public,anon,authenticated;
revoke all on function public.admin_set_court_extra_sports(uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.admin_set_court_showcase(uuid,boolean) from public,anon,authenticated;
revoke all on function public.admin_update_court_sport_settings(uuid,uuid[],boolean) from public,anon,authenticated;
revoke all on function public.get_public_business_showcase(text) from public,anon,authenticated;
revoke all on function public.get_public_platform_catalog(text,text) from public,anon,authenticated;
grant execute on function public.admin_get_court_sport_settings(uuid) to authenticated;
grant execute on function public.admin_set_court_extra_sports(uuid,uuid[]) to authenticated;
grant execute on function public.admin_set_court_showcase(uuid,boolean) to authenticated;
grant execute on function public.admin_update_court_sport_settings(uuid,uuid[],boolean) to authenticated;
grant execute on function public.get_public_business_showcase(text) to anon,authenticated;
grant execute on function public.get_public_platform_catalog(text,text) to anon,authenticated;

-- Datos reales proporcionados por el usuario y verificados contra el catálogo.
-- No cambiar la court_id existente: protege su agenda e historial.
update public.businesses b set name='Polideportivo San Sebastián',short_name='San Sebastián'
where b.id='73426eb7-4a4f-405b-b0bd-be06cd53aa3f'::uuid and b.name='Polideportivo San Sebastian';

update public.venues v set name='Polideportivo San Sebastián'
where v.id='5239b90d-19a8-4dd5-8a43-6996fb7b3294'::uuid and v.name='Polideportivo San Sebastian';

update public.courts c set name='Campo 1', sort_order=1
where c.id='d86214c0-03bb-4104-a848-af70e34cbab7'::uuid
  and c.business_id='73426eb7-4a4f-405b-b0bd-be06cd53aa3f'::uuid
  and c.name='Polideportivo San Sebastian';

insert into public.courts(business_id,venue_id,sport_id,slug,name,sort_order,is_active,configuration_status)
select b.id,v.id,s.id,'campo-2','Campo 2',2,false,'provisional'::public.configuration_status
from public.businesses b
join public.venues v on v.business_id=b.id and v.id='5239b90d-19a8-4dd5-8a43-6996fb7b3294'::uuid
join public.sports s on s.slug='futbol' and s.is_active
where b.id='73426eb7-4a4f-405b-b0bd-be06cd53aa3f'::uuid
  and not exists(select 1 from public.courts c where c.business_id=b.id and c.slug='campo-2');

insert into public.court_extra_sports(business_id,court_id,sport_id)
select c.business_id,c.id,s.id from public.courts c
join public.sports s on s.slug=case when c.slug='campo-2' then 'voley' else 'futbol' end
where c.business_id='73426eb7-4a4f-405b-b0bd-be06cd53aa3f'::uuid
  and c.id in ('d86214c0-03bb-4104-a848-af70e34cbab7'::uuid,
               (select c2.id from public.courts c2 where c2.business_id=c.business_id and c2.slug='campo-2'))
  and s.id<>c.sport_id
on conflict do nothing;

insert into public.court_public_showcase(business_id,court_id,is_visible)
select c.business_id,c.id,true from public.courts c
where c.business_id='73426eb7-4a4f-405b-b0bd-be06cd53aa3f'::uuid
  and (c.id='d86214c0-03bb-4104-a848-af70e34cbab7'::uuid or c.slug='campo-2')
on conflict (court_id) do update set is_visible=true;

update public.business_site_content sc
set theme=coalesce(sc.theme,'{}'::jsonb)||jsonb_build_object(
  'navy','#082819','blue','#266039','blueDark','#174528',
  'red','#295C2F','redDark','#194324','yellow','#A1C92F','canvas','#F3F8EC',
  'visualStyle','stadium','pageHeadline','Polideportivo San Sebastián',
  'pageIntro','Dos campos para fútbol y vóley en Cajamarca. Elige el tuyo y consulta la disponibilidad directamente.'
)
where sc.business_id='73426eb7-4a4f-405b-b0bd-be06cd53aa3f'::uuid;

-- La versión del estudio estaba publicada (v5) antes de este cambio de identidad.
-- Sincronizar solo ese borrador conocido para que guardar luego no restaure la paleta azul.
-- Una edición posterior del propietario no se sobrescribe.
update private.platform_page_builder_drafts d
set content=jsonb_set(d.content,'{theme}',sc.theme,true),
    based_on_updated_at=sc.updated_at,
    updated_at=now(),
    version=d.version+1
from public.business_site_content sc
where d.business_id=sc.business_id
  and d.business_id='73426eb7-4a4f-405b-b0bd-be06cd53aa3f'::uuid
  and d.version=5
  and d.updated_at<='2026-11-11 20:36:44.946188+00'::timestamptz;
