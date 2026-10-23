-- Plataforma global multi-cancha · Bloque 2
-- Extiende el esquema existente sin reemplazar las tablas/RPC operativas ya validadas.
-- Objetivos: identidad global, negocios con sedes, deportes normalizados y canchas
-- vinculadas a sede/deporte, manteniendo compatibilidad con Valeibol y reservas actuales.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'platform_role'
  ) then
    create type public.platform_role as enum ('customer', 'owner', 'admin');
  end if;
end
$$;

create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  icon text,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sports (id, slug, name, sort_order) values
  ('60000000-0000-4000-8000-000000000001', 'voley', 'Vóley', 10),
  ('60000000-0000-4000-8000-000000000002', 'futbol', 'Fútbol', 20),
  ('60000000-0000-4000-8000-000000000003', 'futsal', 'Futsal', 30),
  ('60000000-0000-4000-8000-000000000004', 'basquet', 'Básquet', 40)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

create table if not exists public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.platform_role not null default 'customer',
  display_name text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.businesses
  add column if not exists owner_user_id uuid references public.user_accounts(user_id) on delete set null;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  city text,
  address text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug),
  unique (id, business_id),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

-- Toda cuenta Auth existente recibe una identidad global sin otorgar privilegios.
insert into public.user_accounts (user_id, role, display_name)
select u.id, 'customer'::public.platform_role, null
from auth.users u
on conflict (user_id) do nothing;

-- Backfill conservador: un owner heredado puede conservar semántica OWNER global.
-- Los roles admin/staff heredados son membresías de UN negocio y jamás se elevan
-- automáticamente a ADMIN global. El rol ADMIN global debe asignarse explícitamente
-- mediante una operación privilegiada fuera del cliente.
update public.user_accounts ua
set role = derived.role,
    updated_at = now()
from (
  select
    p.user_id,
    case
      when bool_or(p.is_active and p.role = 'owner') then 'owner'::public.platform_role
      else 'customer'::public.platform_role
    end as role
  from public.profiles p
  group by p.user_id
) derived
where ua.user_id = derived.user_id;

update public.businesses b
set owner_user_id = (
      select p.user_id
      from public.profiles p
      where p.business_id = b.id
        and p.is_active
        and p.role = 'owner'
      order by p.created_at, p.user_id
      limit 1
    ),
    updated_at = now()
where b.owner_user_id is null
  and exists (
    select 1
    from public.profiles p
    where p.business_id = b.id
      and p.is_active
      and p.role = 'owner'
  );

-- Sede determinística para el tenant actual; el resto de negocios existentes recibe
-- una sede principal generada a partir de sus datos actuales.
insert into public.venues (
  id, business_id, slug, name, city, address, is_active, sort_order
)
select
  '30000000-0000-4000-8000-000000000001'::uuid,
  b.id,
  'sede-principal',
  concat_ws(' ', b.name, nullif(b.city, '')),
  b.city,
  b.address,
  true,
  0
from public.businesses b
where b.id = '10000000-0000-4000-8000-000000000001'::uuid
on conflict (business_id, slug) do update set
  name = excluded.name,
  city = excluded.city,
  address = excluded.address,
  is_active = true,
  updated_at = now();

insert into public.venues (business_id, slug, name, city, address, is_active, sort_order)
select
  b.id,
  'sede-principal',
  concat_ws(' ', b.name, nullif(b.city, '')),
  b.city,
  b.address,
  true,
  0
from public.businesses b
where not exists (
  select 1 from public.venues v
  where v.business_id = b.id and v.slug = 'sede-principal'
);

alter table public.courts
  add column if not exists venue_id uuid,
  add column if not exists sport_id uuid,
  add column if not exists surface text;

update public.courts c
set venue_id = v.id
from public.venues v
where c.venue_id is null
  and v.business_id = c.business_id
  and v.slug = 'sede-principal';

update public.courts
set sport_id = '60000000-0000-4000-8000-000000000001'::uuid
where sport_id is null;

alter table public.courts
  alter column venue_id set not null,
  alter column sport_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'courts_venue_business_fkey') then
    alter table public.courts
      add constraint courts_venue_business_fkey
      foreign key (venue_id, business_id)
      references public.venues(id, business_id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'courts_sport_id_fkey') then
    alter table public.courts
      add constraint courts_sport_id_fkey
      foreign key (sport_id)
      references public.sports(id)
      on delete restrict;
  end if;
end
$$;

alter table public.customers
  add column if not exists user_id uuid references public.user_accounts(user_id) on delete set null;

alter table public.reservations
  add column if not exists user_id uuid references public.user_accounts(user_id) on delete set null;

update public.reservations r
set user_id = c.user_id
from public.customers c
where r.customer_id = c.id
  and r.business_id = c.business_id
  and r.user_id is null
  and c.user_id is not null;

create unique index if not exists customers_business_user_unique
  on public.customers (business_id, user_id)
  where user_id is not null and archived_at is null;

create index if not exists businesses_owner_user_idx
  on public.businesses (owner_user_id)
  where owner_user_id is not null;
create index if not exists venues_business_active_idx
  on public.venues (business_id, is_active, sort_order);
create index if not exists courts_venue_idx
  on public.courts (venue_id, sort_order)
  where is_active;
create index if not exists courts_sport_idx
  on public.courts (sport_id, sort_order)
  where is_active;
create index if not exists customers_user_idx
  on public.customers (user_id)
  where user_id is not null;
create index if not exists reservations_user_start_idx
  on public.reservations (user_id, start_at)
  where user_id is not null;

create trigger sports_set_updated_at before update on public.sports
for each row execute function public.set_updated_at();
create trigger user_accounts_set_updated_at before update on public.user_accounts
for each row execute function public.set_updated_at();
create trigger venues_set_updated_at before update on public.venues
for each row execute function public.set_updated_at();

create or replace function private.handle_new_user_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_accounts (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user_account() from public, anon, authenticated;

drop trigger if exists auth_users_create_platform_account on auth.users;
create trigger auth_users_create_platform_account
after insert on auth.users
for each row execute function private.handle_new_user_account();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_accounts ua
    where ua.user_id = (select auth.uid())
      and ua.is_active
      and ua.role = 'admin'
  );
$$;

create or replace function public.can_view_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id = target_business_id
        and b.owner_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.business_id = target_business_id
        and p.is_active
        and p.role in ('owner', 'admin', 'staff')
    );
$$;

create or replace function public.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.businesses b
      where b.id = target_business_id
        and b.owner_user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.business_id = target_business_id
        and p.is_active
        and p.role in ('owner', 'admin')
    );
$$;

-- Catálogo público sanitizado para los bloques de descubrimiento posteriores.
create or replace function public.get_public_platform_catalog(
  p_sport_slug text default null,
  p_city text default null
)
returns table (
  business_id uuid,
  business_slug text,
  business_name text,
  business_city text,
  business_country text,
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
  select
    b.id,
    b.slug,
    b.name,
    b.city,
    b.country,
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

alter table public.sports enable row level security;
alter table public.user_accounts enable row level security;
alter table public.venues enable row level security;

drop policy if exists sports_public_select on public.sports;
create policy sports_public_select on public.sports
for select to anon, authenticated
using (is_active);

drop policy if exists user_accounts_self_or_platform_admin_select on public.user_accounts;
create policy user_accounts_self_or_platform_admin_select on public.user_accounts
for select to authenticated
using (user_id = (select auth.uid()) or public.is_platform_admin());

drop policy if exists venues_admin_select on public.venues;
create policy venues_admin_select on public.venues
for select to authenticated
using (public.can_view_business(business_id));

revoke all on public.sports, public.user_accounts, public.venues from anon, authenticated;
grant select on public.sports to anon, authenticated;
grant select on public.user_accounts, public.venues to authenticated;

revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated;

revoke all on function public.can_view_business(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_business(uuid) from public, anon, authenticated;
grant execute on function public.can_view_business(uuid) to authenticated;
grant execute on function public.can_manage_business(uuid) to authenticated;

revoke all on function public.get_public_platform_catalog(text,text) from public;
grant execute on function public.get_public_platform_catalog(text,text) to anon, authenticated;

comment on table public.user_accounts is
  'Identidad global de plataforma. role representa CUSTOMER/OWNER/ADMIN; profiles conserva membresías administrativas por negocio para compatibilidad.';
comment on table public.venues is
  'Sedes físicas de cada negocio. Una sede puede contener varias canchas.';
comment on table public.sports is
  'Catálogo global normalizado de deportes disponibles en la plataforma.';
comment on column public.businesses.owner_user_id is
  'Propietario global principal del negocio; perfiles de negocio existentes siguen siendo válidos.';
