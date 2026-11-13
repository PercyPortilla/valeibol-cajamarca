-- Caxas: auditoría multitenant del control de accesos; sin contraseñas,
-- correos ni enlaces de activación almacenados.
-- Solo la Edge Function autorizada usa service_role para leer/escribir.
create table if not exists public.platform_team_access_audit (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_user_id uuid not null,
  target_user_id uuid,
  event_type text not null check (event_type in (
    'invite', 'provision', 'update', 'recovery', 'invitation_link'
  )),
  result text not null check (result in ('pending', 'success', 'failed')),
  error_code text,
  cooldown_slot bigint,
  created_at timestamptz not null default now()
);

create index if not exists platform_team_access_audit_business_recent
  on public.platform_team_access_audit (business_id, created_at desc, id desc);

-- Solo una solicitud por destinatario y ventana de 15 minutos. Este índice
-- evita carreras entre pestañas, incluso si se envían dos solicitudes a la vez.
create unique index if not exists platform_team_access_audit_cooldown
  on public.platform_team_access_audit
    (business_id, target_user_id, event_type, cooldown_slot)
  where cooldown_slot is not null;

alter table public.platform_team_access_audit enable row level security;
revoke all on table public.platform_team_access_audit from public, anon, authenticated;
grant select, insert, update on table public.platform_team_access_audit to service_role;
revoke all on sequence public.platform_team_access_audit_id_seq from public, anon, authenticated;
grant usage, select on sequence public.platform_team_access_audit_id_seq to service_role;

comment on table public.platform_team_access_audit is
  'Eventos del equipo por negocio. No almacenar credenciales, email, JWT ni action links.';
