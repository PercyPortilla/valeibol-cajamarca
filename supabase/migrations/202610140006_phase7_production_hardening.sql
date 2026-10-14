-- Valeibol · Hardening previo a producción
-- Refuerza la única escritura pública sin exponer PII ni service-role al navegador.

create table if not exists public.public_booking_rate_limits (
  business_id uuid not null references public.businesses(id) on delete cascade,
  fingerprint_hash text not null check (char_length(fingerprint_hash) between 32 and 128),
  window_start timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now(),
  primary key (business_id, fingerprint_hash, window_start)
);

alter table public.public_booking_rate_limits enable row level security;
revoke all on public.public_booking_rate_limits from public, anon, authenticated;

comment on table public.public_booking_rate_limits is
  'Contadores privados antiabuso. Solo almacena HMAC irreversible del origen, nunca IP en claro.';

create or replace function public.consume_public_booking_rate_limit(
  p_business_slug text,
  p_fingerprint_hash text,
  p_limit integer default 12
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_window timestamptz;
  v_attempts integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid_rate_limit' using errcode = '22023';
  end if;

  if p_fingerprint_hash is null
     or char_length(p_fingerprint_hash) < 32
     or char_length(p_fingerprint_hash) > 128
     or p_fingerprint_hash !~ '^[a-f0-9]+$' then
    raise exception 'invalid_fingerprint' using errcode = '22023';
  end if;

  select id into v_business_id
  from public.businesses
  where slug = p_business_slug
    and is_active
  limit 1;

  if v_business_id is null then
    raise exception 'business_not_found' using errcode = 'P0002';
  end if;

  -- Ventanas fijas de 15 minutos.
  v_window := to_timestamp(floor(extract(epoch from now()) / 900) * 900);

  insert into public.public_booking_rate_limits (
    business_id, fingerprint_hash, window_start, attempts
  ) values (
    v_business_id, p_fingerprint_hash, v_window, 1
  )
  on conflict (business_id, fingerprint_hash, window_start)
  do update set
    attempts = public.public_booking_rate_limits.attempts + 1,
    updated_at = now()
  returning attempts into v_attempts;

  -- Limpieza oportunista; no afecta la decisión actual.
  delete from public.public_booking_rate_limits
  where updated_at < now() - interval '2 days';

  return v_attempts <= p_limit;
end;
$$;

create or replace function public.enforce_public_booking_customer_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent integer;
begin
  if new.source <> 'public_web' or new.customer_id is null then
    return new;
  end if;

  select count(*) into v_recent
  from public.reservations r
  where r.business_id = new.business_id
    and r.customer_id = new.customer_id
    and r.source = 'public_web'
    and r.created_at >= now() - interval '1 hour';

  if v_recent >= 8 then
    raise exception 'public_customer_rate_limited' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_public_customer_rate_limit on public.reservations;
create trigger reservations_public_customer_rate_limit
before insert on public.reservations
for each row execute function public.enforce_public_booking_customer_rate_limit();

-- La escritura pública pasa obligatoriamente por el endpoint server-side.
-- Así el navegador no puede saltarse el rate limit de origen llamando PostgREST directamente.
revoke all on function public.create_public_reservation_request(
  text, uuid, date, time, time, public.lighting_mode, text, text, boolean, uuid
) from anon, authenticated;

grant execute on function public.create_public_reservation_request(
  text, uuid, date, time, time, public.lighting_mode, text, text, boolean, uuid
) to service_role;

revoke all on function public.consume_public_booking_rate_limit(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.consume_public_booking_rate_limit(text, text, integer)
  to service_role;

revoke all on function public.enforce_public_booking_customer_rate_limit()
  from public, anon, authenticated;

comment on function public.consume_public_booking_rate_limit(text, text, integer) is
  'Rate limit privado para el endpoint server-side. El fingerprint debe ser HMAC; nunca una IP en claro.';
