-- Plataforma global · Bloque 8
-- Pagos manuales trazables. No procesa dinero ni integra pasarelas externas.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_method'
  ) then
    create type public.payment_method as enum ('yape', 'plin', 'cash', 'bank_transfer');
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_status'
  ) then
    create type public.payment_status as enum ('reported', 'verified', 'rejected', 'refunded');
  end if;
end
$$;

create table if not exists public.business_payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  method public.payment_method not null,
  label text not null,
  destination text,
  instructions text,
  is_active boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, method),
  check (destination is null or char_length(destination) between 2 and 160),
  check (instructions is null or char_length(instructions) <= 500)
);

insert into public.business_payment_methods (business_id, method, label, is_active, sort_order)
select b.id, valueset.method, valueset.label, false, valueset.sort_order
from public.businesses b
cross join (values
  ('yape'::public.payment_method, 'Yape', 10),
  ('plin'::public.payment_method, 'Plin', 20),
  ('cash'::public.payment_method, 'Efectivo', 30),
  ('bank_transfer'::public.payment_method, 'Transferencia bancaria', 40)
) as valueset(method, label, sort_order)
on conflict (business_id, method) do nothing;

create table if not exists public.reservation_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  user_id uuid references public.user_accounts(user_id) on delete set null,
  method public.payment_method not null,
  status public.payment_status not null default 'reported',
  amount numeric(10,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  customer_reference text,
  internal_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_reference is null or char_length(customer_reference) <= 160),
  check (internal_note is null or char_length(internal_note) <= 500),
  check ((status in ('verified','rejected','refunded') and reviewed_at is not null) or status = 'reported')
);

create unique index if not exists reservation_payments_one_open_idx
  on public.reservation_payments (reservation_id)
  where status in ('reported', 'verified');
create index if not exists reservation_payments_business_created_idx
  on public.reservation_payments (business_id, created_at desc);
create index if not exists reservation_payments_user_created_idx
  on public.reservation_payments (user_id, created_at desc)
  where user_id is not null;

create trigger business_payment_methods_set_updated_at before update on public.business_payment_methods
for each row execute function public.set_updated_at();
create trigger reservation_payments_set_updated_at before update on public.reservation_payments
for each row execute function public.set_updated_at();

create or replace function public.get_public_payment_methods(p_business_slug text)
returns table (
  method public.payment_method,
  label text,
  destination text,
  instructions text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pm.method, pm.label, pm.destination, pm.instructions
  from public.business_payment_methods pm
  join public.businesses b on b.id = pm.business_id
  where b.slug = p_business_slug
    and b.is_active
    and pm.is_active
  order by pm.sort_order, pm.label;
$$;

create or replace function public.report_my_payment(
  p_reservation_id uuid,
  p_method public.payment_method,
  p_reference text default null
)
returns table (
  payment_id uuid,
  payment_status public.payment_status,
  amount numeric,
  currency text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_reservation public.reservations%rowtype;
  v_payment public.reservation_payments%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reference, ''))) > 160 then
    raise exception 'invalid_payment_reference' using errcode = '22023';
  end if;

  select r.* into v_reservation
  from public.reservations r
  where r.id = p_reservation_id
    and r.user_id = v_uid
    and r.status in ('pending', 'confirmed', 'completed')
  for share;
  if not found then
    raise exception 'reservation_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.business_payment_methods pm
    where pm.business_id = v_reservation.business_id
      and pm.method = p_method
      and pm.is_active
  ) then
    raise exception 'payment_method_unavailable' using errcode = '22023';
  end if;

  begin
    insert into public.reservation_payments (
      business_id, reservation_id, user_id, method, status,
      amount, currency, customer_reference
    )
    select
      v_reservation.business_id,
      v_reservation.id,
      v_uid,
      p_method,
      'reported',
      v_reservation.total_amount,
      b.currency,
      nullif(trim(coalesce(p_reference, '')), '')
    from public.businesses b
    where b.id = v_reservation.business_id
    returning * into v_payment;
  exception
    when unique_violation then
      raise exception 'payment_already_reported' using errcode = '23505';
  end;

  return query select v_payment.id, v_payment.status, v_payment.amount, v_payment.currency;
end;
$$;

create or replace function public.get_my_payments()
returns table (
  payment_id uuid,
  reservation_id uuid,
  business_name text,
  method public.payment_method,
  status public.payment_status,
  amount numeric,
  currency text,
  customer_reference text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.reservation_id, b.name, p.method, p.status, p.amount,
         p.currency, p.customer_reference, p.created_at
  from public.reservation_payments p
  join public.businesses b on b.id = p.business_id
  where p.user_id = (select auth.uid())
  order by p.created_at desc;
$$;

create or replace function public.get_admin_payment_methods()
returns table (
  method public.payment_method,
  label text,
  destination text,
  instructions text,
  is_active boolean,
  sort_order integer
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
  if v_actor.user_id is null then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;
  return query
  select pm.method, pm.label, pm.destination, pm.instructions, pm.is_active, pm.sort_order
  from public.business_payment_methods pm
  where pm.business_id = v_actor.business_id
  order by pm.sort_order, pm.label;
end;
$$;

create or replace function public.admin_set_payment_method(
  p_method public.payment_method,
  p_enabled boolean,
  p_destination text default null,
  p_instructions text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
  v_label text;
  v_destination text := nullif(trim(coalesce(p_destination, '')), '');
  v_instructions text := nullif(trim(coalesce(p_instructions, '')), '');
begin
  select * into v_actor from public.phase6_admin_actor();
  if v_actor.user_id is null or v_actor.role not in ('owner','admin') then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;
  if coalesce(p_enabled, false) and p_method in ('yape','plin','bank_transfer') and v_destination is null then
    raise exception 'payment_destination_required' using errcode = '22023';
  end if;
  if v_destination is not null and char_length(v_destination) > 160 then
    raise exception 'payment_destination_invalid' using errcode = '22023';
  end if;
  if v_instructions is not null and char_length(v_instructions) > 500 then
    raise exception 'payment_instructions_invalid' using errcode = '22023';
  end if;

  v_label := case p_method
    when 'yape' then 'Yape'
    when 'plin' then 'Plin'
    when 'cash' then 'Efectivo'
    when 'bank_transfer' then 'Transferencia bancaria'
  end;

  insert into public.business_payment_methods (
    business_id, method, label, destination, instructions, is_active,
    sort_order
  ) values (
    v_actor.business_id, p_method, v_label, v_destination, v_instructions,
    coalesce(p_enabled, false),
    case p_method when 'yape' then 10 when 'plin' then 20 when 'cash' then 30 else 40 end
  )
  on conflict (business_id, method) do update set
    destination = excluded.destination,
    instructions = excluded.instructions,
    is_active = excluded.is_active,
    updated_at = now();
  return true;
end;
$$;

create or replace function public.get_admin_payments(p_limit integer default 100)
returns table (
  payment_id uuid,
  reservation_id uuid,
  customer_name text,
  court_name text,
  method public.payment_method,
  status public.payment_status,
  amount numeric,
  currency text,
  customer_reference text,
  internal_note text,
  created_at timestamptz,
  reviewed_at timestamptz
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
  if v_actor.user_id is null then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;
  return query
  select p.id, p.reservation_id, c.full_name, court.name, p.method, p.status,
         p.amount, p.currency, p.customer_reference, p.internal_note,
         p.created_at, p.reviewed_at
  from public.reservation_payments p
  join public.reservations r on r.id = p.reservation_id and r.business_id = p.business_id
  left join public.customers c on c.id = r.customer_id and c.business_id = r.business_id
  join public.courts court on court.id = r.court_id
  where p.business_id = v_actor.business_id
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_status public.payment_status,
  p_internal_note text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor record;
begin
  select * into v_actor from public.phase6_admin_actor();
  if v_actor.user_id is null or v_actor.role not in ('owner','admin') then
    raise exception 'admin_access_denied' using errcode = '42501';
  end if;
  if p_status not in ('verified','rejected') then
    raise exception 'invalid_payment_review_status' using errcode = '22023';
  end if;
  if char_length(coalesce(p_internal_note, '')) > 500 then
    raise exception 'payment_note_invalid' using errcode = '22023';
  end if;

  update public.reservation_payments p
  set status = p_status,
      internal_note = nullif(trim(coalesce(p_internal_note, '')), ''),
      reviewed_by = v_actor.user_id,
      reviewed_at = now(),
      updated_at = now()
  where p.id = p_payment_id
    and p.business_id = v_actor.business_id
    and p.status = 'reported';
  if not found then
    raise exception 'payment_not_found_or_reviewed' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

alter table public.business_payment_methods enable row level security;
alter table public.reservation_payments enable row level security;
revoke all on public.business_payment_methods, public.reservation_payments from anon, authenticated;

revoke all on function public.get_public_payment_methods(text) from public;
grant execute on function public.get_public_payment_methods(text) to anon, authenticated;

revoke all on function public.report_my_payment(uuid,public.payment_method,text) from public, anon;
revoke all on function public.get_my_payments() from public, anon;
grant execute on function public.report_my_payment(uuid,public.payment_method,text) to authenticated;
grant execute on function public.get_my_payments() to authenticated;

revoke all on function public.get_admin_payment_methods() from public, anon;
revoke all on function public.admin_set_payment_method(public.payment_method,boolean,text,text) from public, anon;
revoke all on function public.get_admin_payments(integer) from public, anon;
revoke all on function public.admin_review_payment(uuid,public.payment_status,text) from public, anon;
grant execute on function public.get_admin_payment_methods() to authenticated;
grant execute on function public.admin_set_payment_method(public.payment_method,boolean,text,text) to authenticated;
grant execute on function public.get_admin_payments(integer) to authenticated;
grant execute on function public.admin_review_payment(uuid,public.payment_status,text) to authenticated;

comment on table public.reservation_payments is
  'Ledger de reportes de pago. verified significa revisión administrativa; no representa liquidación de una pasarela externa.';
