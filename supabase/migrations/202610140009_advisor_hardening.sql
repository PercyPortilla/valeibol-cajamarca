-- Valeibol · hardening posterior a Advisors reales de Supabase

-- Función trigger estable frente a search_path mutable.
alter function public.set_updated_at() set search_path = public, pg_temp;

-- Las funciones trigger nunca son una API de navegador.
revoke all on function public.sync_reservation_schedule_entry() from public, anon, authenticated;
revoke all on function public.sync_block_schedule_entry() from public, anon, authenticated;

-- El CRUD directo authenticated ya está revocado. Estas políticas FOR ALL eran
-- redundantes y generaban políticas permisivas SELECT duplicadas.
drop policy if exists businesses_admin_write on public.businesses;
drop policy if exists courts_admin_write on public.courts;
drop policy if exists profiles_admin_write on public.profiles;
drop policy if exists operating_hours_admin_write on public.operating_hours;
drop policy if exists pricing_rules_admin_write on public.pricing_rules;
drop policy if exists customers_admin_write on public.customers;
drop policy if exists reservations_admin_write on public.reservations;
drop policy if exists schedule_blocks_admin_write on public.schedule_blocks;

-- Evita reevaluar auth.uid() por fila.
drop policy if exists profiles_self_or_admin_select on public.profiles;
create policy profiles_self_or_admin_select on public.profiles
for select to authenticated
using (user_id = (select auth.uid()) or public.can_view_business(business_id));

-- Índices de soporte para claves foráneas reportadas por Performance Advisors.
create index if not exists court_schedule_entries_business_idx
  on public.court_schedule_entries (business_id);
create index if not exists court_schedule_entries_court_business_idx
  on public.court_schedule_entries (court_id, business_id);

create index if not exists pricing_rules_created_by_idx
  on public.pricing_rules (created_by);

create index if not exists reservations_court_business_idx
  on public.reservations (court_id, business_id);
create index if not exists reservations_created_by_idx
  on public.reservations (created_by);
create index if not exists reservations_customer_business_idx
  on public.reservations (customer_id, business_id);
create index if not exists reservations_last_modified_by_idx
  on public.reservations (last_modified_by);

create index if not exists schedule_blocks_business_idx
  on public.schedule_blocks (business_id);
create index if not exists schedule_blocks_court_business_idx
  on public.schedule_blocks (court_id, business_id);
create index if not exists schedule_blocks_created_by_idx
  on public.schedule_blocks (created_by);
create index if not exists schedule_blocks_last_modified_by_idx
  on public.schedule_blocks (last_modified_by);

create index if not exists whatsapp_outbox_business_idx
  on public.whatsapp_outbox (business_id);
