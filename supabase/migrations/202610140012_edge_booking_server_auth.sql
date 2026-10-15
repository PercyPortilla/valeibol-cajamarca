-- Valeibol · autenticación server-to-server para Edge Function de reservas públicas
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.server_integration_secrets (
  name text primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

revoke all on private.server_integration_secrets from public, anon, authenticated;

create or replace function public.validate_server_integration_secret(
  p_name text,
  p_secret_hash text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from private.server_integration_secrets s
    where s.name = p_name
      and s.secret_hash = p_secret_hash
  );
$$;

revoke all on function public.validate_server_integration_secret(text,text) from public, anon, authenticated;
grant execute on function public.validate_server_integration_secret(text,text) to service_role;
