-- Valeibol · Fase 3
-- Modelo base para Supabase/PostgreSQL.
-- Objetivos: privacidad por defecto, múltiples canchas, horarios/tarifas versionables
-- y prevención de solapamientos a nivel de base de datos.

create extension if not exists btree_gist;

create type public.configuration_status as enum ('provisional', 'confirmed');
create type public.app_role as enum ('owner', 'admin', 'staff');
create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
create type public.block_status as enum ('active', 'cancelled');
create type public.block_reason as enum ('maintenance', 'academy', 'tournament', 'event', 'closure', 'other');
create type public.lighting_mode as enum ('without_lights', 'with_lights');
create type public.reservation_source as enum ('public_web', 'admin', 'phone', 'whatsapp', 'other');
create type public.schedule_entry_kind as enum ('reservation', 'block');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  short_name text,
  category text,
  city text,
  country text,
  address text,
  phone text,
  currency text not null default 'PEN' check (char_length(currency) = 3),
  timezone text not null default 'America/Lima',
  configuration_status public.configuration_status not null default 'provisional',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  configuration_status public.configuration_status not null default 'provisional',
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug),
  unique (id, business_id)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role public.app_role not null default 'staff',
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.operating_hours (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: lunes=1, domingo=7
  is_open boolean not null default true,
  opens_at time,
  closes_at time,
  effective_from date not null default date '1970-01-01',
  effective_until date,
  configuration_status public.configuration_status not null default 'provisional',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  check (
    (is_open and opens_at is not null and closes_at is not null and opens_at < closes_at)
    or
    (not is_open and opens_at is null and closes_at is null)
  ),
  exclude using gist (
    court_id with =,
    weekday with =,
    daterange(effective_from, coalesce(effective_until + 1, 'infinity'::date), '[)') with &&
  )
);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  lighting public.lighting_mode not null,
  label text not null,
  hourly_rate numeric(10,2) not null check (hourly_rate > 0),
  effective_from date not null default current_date,
  effective_until date,
  is_active boolean not null default true,
  configuration_status public.configuration_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  exclude using gist (
    court_id with =,
    lighting with =,
    daterange(effective_from, coalesce(effective_until + 1, 'infinity'::date), '[)') with &&
  ) where (is_active)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text not null,
  phone_e164 text,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  internal_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  check (phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  check ((marketing_opt_in and marketing_opt_in_at is not null) or not marketing_opt_in)
);

create unique index customers_business_phone_unique
  on public.customers (business_id, phone_e164)
  where phone_e164 is not null and archived_at is null;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  court_id uuid not null,
  customer_id uuid,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.reservation_status not null default 'pending',
  lighting public.lighting_mode not null,
  hourly_rate numeric(10,2) not null check (hourly_rate > 0),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  source public.reservation_source not null default 'public_web',
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  foreign key (court_id, business_id) references public.courts(id, business_id) on delete cascade,
  foreign key (customer_id, business_id) references public.customers(id, business_id) on delete restrict
);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  court_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.block_status not null default 'active',
  reason public.block_reason not null default 'other',
  internal_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  foreign key (court_id, business_id) references public.courts(id, business_id) on delete cascade
);

-- Ledger interno único de ocupación.
-- Tanto reservas como bloqueos se sincronizan aquí mediante triggers SECURITY DEFINER.
-- La restricción EXCLUDE es la fuente de verdad para impedir cruces, incluso bajo concurrencia.
create table public.court_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  court_id uuid not null,
  source_kind public.schedule_entry_kind not null,
  source_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  blocks_availability boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  unique (source_kind, source_id),
  foreign key (court_id, business_id) references public.courts(id, business_id) on delete cascade,
  exclude using gist (
    court_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (blocks_availability)
);

create index reservations_business_start_idx on public.reservations (business_id, start_at);
create index reservations_court_start_idx on public.reservations (court_id, start_at);
create index reservations_customer_idx on public.reservations (customer_id) where customer_id is not null;
create index schedule_blocks_court_start_idx on public.schedule_blocks (court_id, start_at);
create index operating_hours_court_weekday_idx on public.operating_hours (court_id, weekday, effective_from);
create index pricing_rules_court_effective_idx on public.pricing_rules (court_id, lighting, effective_from);
create index court_schedule_entries_window_idx on public.court_schedule_entries (court_id, start_at, end_at) where blocks_availability;
create index profiles_business_idx on public.profiles (business_id, role) where is_active;

create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();
create trigger courts_set_updated_at before update on public.courts
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger operating_hours_set_updated_at before update on public.operating_hours
for each row execute function public.set_updated_at();
create trigger pricing_rules_set_updated_at before update on public.pricing_rules
for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations
for each row execute function public.set_updated_at();
create trigger schedule_blocks_set_updated_at before update on public.schedule_blocks
for each row execute function public.set_updated_at();
create trigger court_schedule_entries_set_updated_at before update on public.court_schedule_entries
for each row execute function public.set_updated_at();

create or replace function public.sync_reservation_schedule_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.court_schedule_entries
    where source_kind = 'reservation' and source_id = old.id;
    return old;
  end if;

  insert into public.court_schedule_entries (
    business_id, court_id, source_kind, source_id, start_at, end_at, blocks_availability
  ) values (
    new.business_id,
    new.court_id,
    'reservation',
    new.id,
    new.start_at,
    new.end_at,
    new.status in ('pending', 'confirmed', 'completed')
  )
  on conflict (source_kind, source_id) do update set
    business_id = excluded.business_id,
    court_id = excluded.court_id,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    blocks_availability = excluded.blocks_availability,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_block_schedule_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.court_schedule_entries
    where source_kind = 'block' and source_id = old.id;
    return old;
  end if;

  insert into public.court_schedule_entries (
    business_id, court_id, source_kind, source_id, start_at, end_at, blocks_availability
  ) values (
    new.business_id,
    new.court_id,
    'block',
    new.id,
    new.start_at,
    new.end_at,
    new.status = 'active'
  )
  on conflict (source_kind, source_id) do update set
    business_id = excluded.business_id,
    court_id = excluded.court_id,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    blocks_availability = excluded.blocks_availability,
    updated_at = now();

  return new;
end;
$$;

create trigger reservations_sync_schedule_entry
after insert or update or delete on public.reservations
for each row execute function public.sync_reservation_schedule_entry();

create trigger blocks_sync_schedule_entry
after insert or update or delete on public.schedule_blocks
for each row execute function public.sync_block_schedule_entry();

-- Helpers de autorización. SECURITY DEFINER evita recursión de RLS en profiles.
create or replace function public.can_view_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
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
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.business_id = target_business_id
      and p.is_active
      and p.role in ('owner', 'admin')
  );
$$;

-- RPC pública sanitizada. No devuelve customer_id, nombres, teléfonos, notas, pagos ni created_by.
create or replace function public.get_public_availability(
  p_business_slug text,
  p_from date,
  p_to date
)
returns table (
  business_id uuid,
  business_name text,
  business_timezone text,
  court_id uuid,
  court_name text,
  calendar_date date,
  is_open boolean,
  opens_at time,
  closes_at time,
  schedule_status public.configuration_status,
  busy_intervals jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  if (p_to - p_from) > 31 then
    raise exception 'date range too large; maximum is 32 calendar days' using errcode = '22023';
  end if;

  return query
  select
    b.id,
    b.name,
    b.timezone,
    c.id,
    c.name,
    d.day::date,
    coalesce(oh.is_open, false),
    oh.opens_at,
    oh.closes_at,
    coalesce(oh.configuration_status, 'provisional'::public.configuration_status),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'startAt', e.start_at,
          'endAt', e.end_at,
          'kind', e.source_kind
        ) order by e.start_at
      ) filter (where e.id is not null),
      '[]'::jsonb
    )
  from public.businesses b
  join public.courts c
    on c.business_id = b.id
   and c.is_active
  cross join lateral generate_series(p_from, p_to, interval '1 day') as d(day)
  left join lateral (
    select oh2.*
    from public.operating_hours oh2
    where oh2.court_id = c.id
      and oh2.weekday = extract(isodow from d.day)::smallint
      and d.day::date >= oh2.effective_from
      and (oh2.effective_until is null or d.day::date <= oh2.effective_until)
    order by oh2.effective_from desc
    limit 1
  ) oh on true
  left join public.court_schedule_entries e
    on e.court_id = c.id
   and e.blocks_availability
   and e.start_at < ((d.day::date + 1)::timestamp at time zone b.timezone)
   and e.end_at > (d.day::date::timestamp at time zone b.timezone)
  where b.slug = p_business_slug
    and b.is_active
  group by b.id, b.name, b.timezone, c.id, c.name, d.day, oh.is_open, oh.opens_at, oh.closes_at, oh.configuration_status
  order by c.sort_order, c.name, d.day;
end;
$$;

create or replace function public.get_public_business_config(p_business_slug text)
returns table (
  business_id uuid,
  business_name text,
  short_name text,
  category text,
  city text,
  country text,
  address text,
  phone text,
  currency text,
  timezone text,
  configuration_status public.configuration_status,
  pricing jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    b.name,
    b.short_name,
    b.category,
    b.city,
    b.country,
    b.address,
    b.phone,
    b.currency,
    b.timezone,
    b.configuration_status,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'courtId', c.id,
          'courtName', c.name,
          'lighting', pr.lighting,
          'label', pr.label,
          'hourlyRate', pr.hourly_rate,
          'status', pr.configuration_status
        ) order by c.sort_order, pr.lighting
      ) filter (where pr.id is not null),
      '[]'::jsonb
    )
  from public.businesses b
  left join public.courts c on c.business_id = b.id and c.is_active
  left join public.pricing_rules pr
    on pr.court_id = c.id
   and pr.is_active
   and current_date >= pr.effective_from
   and (pr.effective_until is null or current_date <= pr.effective_until)
  where b.slug = p_business_slug
    and b.is_active
  group by b.id;
$$;

-- RLS: privacidad por defecto.
alter table public.businesses enable row level security;
alter table public.courts enable row level security;
alter table public.profiles enable row level security;
alter table public.operating_hours enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.customers enable row level security;
alter table public.reservations enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.court_schedule_entries enable row level security;

create policy businesses_admin_select on public.businesses
for select to authenticated using (public.can_view_business(id));
create policy businesses_admin_write on public.businesses
for all to authenticated using (public.can_manage_business(id)) with check (public.can_manage_business(id));

create policy courts_admin_select on public.courts
for select to authenticated using (public.can_view_business(business_id));
create policy courts_admin_write on public.courts
for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

create policy profiles_self_or_admin_select on public.profiles
for select to authenticated using (user_id = auth.uid() or public.can_view_business(business_id));
create policy profiles_admin_write on public.profiles
for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

create policy operating_hours_admin_select on public.operating_hours
for select to authenticated using (
  exists (select 1 from public.courts c where c.id = court_id and public.can_view_business(c.business_id))
);
create policy operating_hours_admin_write on public.operating_hours
for all to authenticated using (
  exists (select 1 from public.courts c where c.id = court_id and public.can_manage_business(c.business_id))
) with check (
  exists (select 1 from public.courts c where c.id = court_id and public.can_manage_business(c.business_id))
);

create policy pricing_rules_admin_select on public.pricing_rules
for select to authenticated using (
  exists (select 1 from public.courts c where c.id = court_id and public.can_view_business(c.business_id))
);
create policy pricing_rules_admin_write on public.pricing_rules
for all to authenticated using (
  exists (select 1 from public.courts c where c.id = court_id and public.can_manage_business(c.business_id))
) with check (
  exists (select 1 from public.courts c where c.id = court_id and public.can_manage_business(c.business_id))
);

create policy customers_admin_select on public.customers
for select to authenticated using (public.can_view_business(business_id));
create policy customers_admin_write on public.customers
for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

create policy reservations_admin_select on public.reservations
for select to authenticated using (public.can_view_business(business_id));
create policy reservations_admin_write on public.reservations
for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

create policy schedule_blocks_admin_select on public.schedule_blocks
for select to authenticated using (public.can_view_business(business_id));
create policy schedule_blocks_admin_write on public.schedule_blocks
for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

-- Ledger: sin políticas de app. Solo triggers SECURITY DEFINER y RPC sanitizada.
revoke all on public.court_schedule_entries from anon, authenticated;

-- No acceso directo público a tablas sensibles/administrativas.
revoke all on public.businesses, public.courts, public.profiles, public.operating_hours,
  public.pricing_rules, public.customers, public.reservations, public.schedule_blocks from anon;

grant select, insert, update, delete on public.businesses, public.courts, public.profiles,
  public.operating_hours, public.pricing_rules, public.customers, public.reservations,
  public.schedule_blocks to authenticated;

revoke all on function public.can_view_business(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_business(uuid) from public, anon, authenticated;
grant execute on function public.can_view_business(uuid) to authenticated;
grant execute on function public.can_manage_business(uuid) to authenticated;

revoke all on function public.get_public_availability(text, date, date) from public;
revoke all on function public.get_public_business_config(text) from public;
grant execute on function public.get_public_availability(text, date, date) to anon, authenticated;
grant execute on function public.get_public_business_config(text) to anon, authenticated;
