-- Bloque 18 · favoritos + reputación/reseñas verificadas.
-- Reutiliza user_accounts/reservations y mantiene PII fuera de las superficies públicas.

create table if not exists public.business_favorites (
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);

do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_moderation_status') then
    create type public.review_moderation_status as enum ('pending', 'published', 'rejected', 'hidden');
  end if;
end
$$;

create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.user_accounts(user_id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status public.review_moderation_status not null default 'pending',
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (comment is null or (char_length(btrim(comment)) between 1 and 1000))
);

create index if not exists business_reviews_business_visible_idx
  on public.business_reviews (business_id, status, created_at desc);
create index if not exists business_reviews_user_idx
  on public.business_reviews (user_id, created_at desc);

drop trigger if exists business_reviews_set_updated_at on public.business_reviews;
create trigger business_reviews_set_updated_at before update on public.business_reviews
for each row execute function public.set_updated_at();

alter table public.business_favorites enable row level security;
alter table public.business_reviews enable row level security;

drop policy if exists business_favorites_self_select on public.business_favorites;
create policy business_favorites_self_select on public.business_favorites
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists business_favorites_self_insert on public.business_favorites;
create policy business_favorites_self_insert on public.business_favorites
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists business_favorites_self_delete on public.business_favorites;
create policy business_favorites_self_delete on public.business_favorites
for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists business_reviews_self_select on public.business_reviews;
create policy business_reviews_self_select on public.business_reviews
for select to authenticated
using (user_id = (select auth.uid()));

revoke all on public.business_favorites, public.business_reviews from public, anon, authenticated;

create or replace function public.get_my_favorite_business_ids()
returns table (business_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.business_id
  from public.business_favorites f
  join public.businesses b on b.id = f.business_id and b.is_active
  join public.user_accounts ua on ua.user_id = f.user_id and ua.is_active
  where f.user_id = (select auth.uid())
  order by f.created_at desc;
$$;

create or replace function public.set_business_favorite(
  p_business_id uuid,
  p_favorite boolean
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_business_id is null or p_favorite is null then
    raise exception 'invalid_favorite_payload' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.user_accounts ua
    where ua.user_id = v_user_id and ua.is_active
  ) then
    raise exception 'inactive_user_account' using errcode = '42501';
  end if;
  if p_favorite then
    if not exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.is_active
    ) then
      raise exception 'business_not_found' using errcode = 'P0002';
    end if;
    insert into public.business_favorites (user_id, business_id)
    values (v_user_id, p_business_id)
    on conflict (user_id, business_id) do nothing;
  else
    delete from public.business_favorites f
    where f.user_id = v_user_id and f.business_id = p_business_id;
  end if;
  return p_favorite;
end;
$$;

create or replace function public.get_my_reviewable_reservations()
returns table (
  reservation_id uuid,
  business_id uuid,
  business_slug text,
  business_name text,
  court_name text,
  sport_name text,
  start_at timestamptz,
  review_id uuid,
  rating smallint,
  comment text,
  review_status public.review_moderation_status
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    r.id,
    b.id,
    b.slug,
    b.name,
    c.name,
    s.name,
    r.start_at,
    rv.id,
    rv.rating,
    rv.comment,
    rv.status
  from public.reservations r
  join public.businesses b on b.id = r.business_id and b.is_active
  join public.courts c on c.id = r.court_id and c.business_id = r.business_id
  join public.sports s on s.id = c.sport_id
  join public.user_accounts ua on ua.user_id = r.user_id and ua.is_active
  left join public.business_reviews rv
    on rv.reservation_id = r.id
   and rv.user_id = r.user_id
   and rv.business_id = r.business_id
  where r.user_id = (select auth.uid())
    and r.status = 'completed'
  order by r.start_at desc, r.created_at desc;
$$;

create or replace function public.submit_verified_business_review(
  p_reservation_id uuid,
  p_rating smallint,
  p_comment text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_review_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if p_reservation_id is null or p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid_review_payload' using errcode = '22023';
  end if;
  if v_comment is not null and char_length(v_comment) > 1000 then
    raise exception 'review_comment_too_long' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.user_accounts ua
    where ua.user_id = v_user_id and ua.is_active
  ) then
    raise exception 'inactive_user_account' using errcode = '42501';
  end if;

  select r.business_id
  into v_business_id
  from public.reservations r
  join public.businesses b on b.id = r.business_id and b.is_active
  where r.id = p_reservation_id
    and r.user_id = v_user_id
    and r.status = 'completed';

  if v_business_id is null then
    raise exception 'review_reservation_not_eligible' using errcode = '42501';
  end if;

  begin
    insert into public.business_reviews (
    reservation_id, business_id, user_id, rating, comment
    ) values (
      p_reservation_id, v_business_id, v_user_id, p_rating, v_comment
    ) returning id into v_review_id;
  exception
    when unique_violation then
      raise exception 'review_already_exists' using errcode = '23505';
  end;
  return v_review_id;
end;
$$;

create or replace function public.get_public_business_reviews(
  p_business_slug text,
  p_limit integer default 12
)
returns table (
  review_id uuid,
  rating smallint,
  created_at timestamptz,
  court_name text,
  sport_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    rv.id,
    rv.rating,
    rv.created_at,
    c.name,
    s.name
  from public.business_reviews rv
  join public.businesses b on b.id = rv.business_id and b.is_active
  join public.reservations r on r.id = rv.reservation_id and r.business_id = rv.business_id
  join public.courts c on c.id = r.court_id and c.business_id = rv.business_id
  join public.sports s on s.id = c.sport_id
  where b.slug = p_business_slug
    and rv.status = 'published'
  order by rv.created_at desc, rv.id desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

create or replace function public.get_platform_admin_reviews_page(
  p_status public.review_moderation_status default 'pending',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  review_id uuid,
  business_name text,
  business_slug text,
  rating smallint,
  comment text,
  review_status public.review_moderation_status,
  created_at timestamptz,
  updated_at timestamptz,
  court_name text,
  sport_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    rv.id,
    b.name,
    b.slug,
    rv.rating,
    rv.comment,
    rv.status,
    rv.created_at,
    rv.updated_at,
    c.name,
    s.name
  from public.business_reviews rv
  join public.businesses b on b.id = rv.business_id
  join public.reservations r on r.id = rv.reservation_id and r.business_id = rv.business_id
  join public.courts c on c.id = r.court_id and c.business_id = rv.business_id
  join public.sports s on s.id = c.sport_id
  where public.is_platform_admin()
    and rv.status = p_status
  order by rv.created_at desc, rv.id desc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.platform_admin_moderate_review(
  p_review_id uuid,
  p_status public.review_moderation_status
)
returns public.review_moderation_status
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_platform_admin() then
    raise exception 'review_moderation_not_allowed' using errcode = '42501';
  end if;
  if p_review_id is null or p_status is null or p_status not in ('published', 'rejected', 'hidden') then
    raise exception 'invalid_review_moderation_payload' using errcode = '22023';
  end if;

  update public.business_reviews rv
  set status = p_status,
      moderated_by = v_user_id,
      moderated_at = now(),
      published_at = case when p_status = 'published' then coalesce(rv.published_at, now()) else rv.published_at end,
      updated_at = now()
  where rv.id = p_review_id;

  if not found then
    raise exception 'review_not_found' using errcode = 'P0002';
  end if;
  return p_status;
end;
$$;

create or replace function public.admin_complete_reservation(p_reservation_id uuid)
returns table (
  reservation_id uuid,
  reservation_status public.reservation_status,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_reservation public.reservations%rowtype;
begin
  select * into v_actor from public.phase6_admin_actor();
  if not found then
    raise exception 'admin_profile_required' using errcode = '42501';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.business_id = v_actor.business_id
  for update;

  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;
  if v_reservation.status = 'completed' then
    return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
    return;
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception 'reservation_not_completable' using errcode = '22023';
  end if;
  if v_reservation.end_at > now() then
    raise exception 'reservation_not_finished' using errcode = '22023';
  end if;

  update public.reservations
  set status = 'completed',
      last_modified_by = v_actor.user_id,
      status_changed_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.status, v_reservation.updated_at;
end;
$$;

-- El catálogo conserva una sola consulta pública y añade reputación agregada sanitizada.
drop function if exists public.get_public_platform_catalog(text, text);

create function public.get_public_platform_catalog(
  p_sport_slug text default null,
  p_city text default null
)
returns table (
  business_id uuid,
  business_slug text,
  business_name text,
  business_city text,
  business_country text,
  cover_image_url text,
  cover_alt_text text,
  rating_average numeric,
  review_count bigint,
  venue_id uuid,
  venue_slug text,
  venue_name text,
  venue_city text,
  venue_address text,
  latitude numeric,
  longitude numeric,
  court_id uuid,
  court_slug text,
  court_name text,
  court_surface text,
  sport_id uuid,
  sport_slug text,
  sport_name text,
  price_from numeric,
  currency text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with reputation as (
    select
      rv.business_id,
      round(avg(rv.rating)::numeric, 1) as rating_average,
      count(*)::bigint as review_count
    from public.business_reviews rv
    where rv.status = 'published'
    group by rv.business_id
  )
  select
    b.id,
    b.slug,
    b.name,
    b.city,
    b.country,
    cover.image_url,
    cover.alt_text,
    rep.rating_average,
    coalesce(rep.review_count, 0)::bigint,
    v.id,
    v.slug,
    v.name,
    v.city,
    v.address,
    v.latitude,
    v.longitude,
    c.id,
    c.slug,
    c.name,
    c.surface,
    s.id,
    s.slug,
    s.name,
    rates.price_from,
    b.currency
  from public.businesses b
  join public.venues v
    on v.business_id = b.id
   and v.is_active
  join public.courts c
    on c.business_id = b.id
   and c.venue_id = v.id
   and c.is_active
  join public.sports s
    on s.id = c.sport_id
   and s.is_active
  left join public.business_site_content site_content
    on site_content.business_id = b.id
  left join lateral (
    select
      nullif(btrim(item->>'imageUrl'), '') as image_url,
      nullif(btrim(item->>'altText'), '') as alt_text
    from jsonb_array_elements(coalesce(site_content.gallery, '[]'::jsonb)) item
    where lower(coalesce(item->>'isVisible', 'true')) not in ('false', 'f', 'no', 'n', '0', 'off')
      and nullif(btrim(item->>'imageUrl'), '') is not null
    order by
      case
        when coalesce(item->>'sortOrder', '') ~ '^[0-9]{1,4}$' then (item->>'sortOrder')::integer
        else 0
      end,
      coalesce(item->>'id', '')
    limit 1
  ) cover on true
  left join reputation rep on rep.business_id = b.id
  left join lateral (
    select min(pr.hourly_rate) as price_from
    from public.pricing_rules pr
    where pr.court_id = c.id
      and pr.is_active
      and ((now() at time zone b.timezone)::date) >= pr.effective_from
      and (pr.effective_until is null or ((now() at time zone b.timezone)::date) <= pr.effective_until)
  ) rates on true
  where b.is_active
    and (p_sport_slug is null or s.slug = p_sport_slug)
    and (p_city is null or lower(coalesce(v.city, b.city, '')) = lower(p_city))
  order by b.name, v.sort_order, v.name, c.sort_order, c.name;
$$;

revoke all on function public.get_my_favorite_business_ids() from public, anon;
revoke all on function public.set_business_favorite(uuid,boolean) from public, anon;
revoke all on function public.get_my_reviewable_reservations() from public, anon;
revoke all on function public.submit_verified_business_review(uuid,smallint,text) from public, anon;
revoke all on function public.get_public_business_reviews(text,integer) from public;
revoke all on function public.get_platform_admin_reviews_page(public.review_moderation_status,integer,integer) from public, anon;
revoke all on function public.platform_admin_moderate_review(uuid,public.review_moderation_status) from public, anon;
revoke all on function public.admin_complete_reservation(uuid) from public, anon;
revoke all on function public.get_public_platform_catalog(text,text) from public;

grant execute on function public.get_my_favorite_business_ids() to authenticated;
grant execute on function public.set_business_favorite(uuid,boolean) to authenticated;
grant execute on function public.get_my_reviewable_reservations() to authenticated;
grant execute on function public.submit_verified_business_review(uuid,smallint,text) to authenticated;
grant execute on function public.get_public_business_reviews(text,integer) to anon, authenticated;
grant execute on function public.get_platform_admin_reviews_page(public.review_moderation_status,integer,integer) to authenticated;
grant execute on function public.platform_admin_moderate_review(uuid,public.review_moderation_status) to authenticated;
grant execute on function public.admin_complete_reservation(uuid) to authenticated;
grant execute on function public.get_public_platform_catalog(text,text) to anon, authenticated;

comment on table public.business_favorites is
  'Favoritos privados de la cuenta global. La identidad se deriva de auth.uid mediante RPCs.';
comment on table public.business_reviews is
  'Reseñas vinculadas 1:1 a reservas completed del propio usuario. Solo published entra a reputación pública.';
comment on function public.get_public_business_reviews(text,integer) is
  'Reputación pública sanitizada: rating, fecha, cancha y deporte; sin comentario libre, identidad ni reservation_id. Todas provienen de una reserva completed.';
comment on function public.get_public_platform_catalog(text,text) is
  'Catálogo público multi-tenant sanitizado con portada y reputación agregada solo desde reseñas visibles verificadas.';
