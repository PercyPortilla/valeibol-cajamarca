-- Seed de desarrollo Fase 4.
-- No contiene clientes reales, nombres de usuarios ni reservas ficticias.
-- El horario de apertura sigue siendo PROVISIONAL hasta confirmación del propietario.

insert into public.businesses (
  id, slug, name, short_name, category, city, country, address, phone,
  currency, timezone, configuration_status, is_active, booking_increment_minutes
) values (
  '10000000-0000-4000-8000-000000000001',
  'valeibol-cajamarca',
  'Valeibol',
  'mi valeibol',
  'Club de voleibol',
  'Cajamarca',
  'Perú',
  'Jr. Guillermo Urrelo 1674, Cajamarca 06001',
  '935 059 868',
  'PEN',
  'America/Lima',
  'provisional',
  true,
  60
) on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  category = excluded.category,
  city = excluded.city,
  country = excluded.country,
  address = excluded.address,
  phone = excluded.phone,
  currency = excluded.currency,
  timezone = excluded.timezone,
  configuration_status = excluded.configuration_status,
  is_active = excluded.is_active,
  booking_increment_minutes = excluded.booking_increment_minutes;

insert into public.courts (
  id, business_id, slug, name, configuration_status, is_active, sort_order
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'cancha-demo',
  'Cancha principal (demo)',
  'provisional',
  true,
  0
) on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  configuration_status = excluded.configuration_status,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- Horario provisional de demostración: 08:00–23:00, lunes a domingo.
-- Reemplazar por el horario real cuando el propietario lo confirme.
insert into public.operating_hours (
  court_id, weekday, is_open, opens_at, closes_at, effective_from, configuration_status
)
select
  '20000000-0000-4000-8000-000000000001'::uuid,
  day_no,
  true,
  time '08:00',
  time '23:00',
  date '2026-01-01',
  'provisional'::public.configuration_status
from generate_series(1, 7) as day_no
on conflict do nothing;

-- Tarifas confirmadas por el usuario.
insert into public.pricing_rules (
  court_id, lighting, label, hourly_rate, effective_from, configuration_status
) values
(
  '20000000-0000-4000-8000-000000000001',
  'without_lights',
  'Sin luz',
  35.00,
  date '2026-01-01',
  'confirmed'
),
(
  '20000000-0000-4000-8000-000000000001',
  'with_lights',
  'Con luz',
  60.00,
  date '2026-01-01',
  'confirmed'
)
on conflict do nothing;
