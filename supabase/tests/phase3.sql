-- Ejecutar sobre una base local reseteada con: supabase db reset
-- Luego: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/phase3.sql
-- El script se ejecuta dentro de una transacción y hace ROLLBACK.

begin;

-- 1) Seed sin clientes reales.
do $$
begin
  if exists (select 1 from public.customers) then
    raise exception 'El seed de Fase 3 no debe crear clientes reales/ficticios';
  end if;
end;
$$;

-- 2) Permisos públicos: anon no tiene SELECT directo en tablas privadas, pero sí puede ejecutar la RPC sanitizada.
do $$
begin
  if has_table_privilege('anon', 'public.customers', 'SELECT') then
    raise exception 'anon no debe tener SELECT directo sobre customers';
  end if;
  if has_table_privilege('anon', 'public.reservations', 'SELECT') then
    raise exception 'anon no debe tener SELECT directo sobre reservations';
  end if;
  if has_table_privilege('anon', 'public.schedule_blocks', 'SELECT') then
    raise exception 'anon no debe tener SELECT directo sobre schedule_blocks';
  end if;
  if not has_function_privilege('anon', 'public.get_public_availability(text,date,date)', 'EXECUTE') then
    raise exception 'anon debe poder ejecutar la RPC pública sanitizada';
  end if;
end;
$$;

-- 3) Privacidad: la RPC pública no expone PII ni identificadores de clientes.
do $$
declare
  payload jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into payload
  from public.get_public_availability('valeibol-cajamarca', date '2026-10-12', date '2026-10-18') x;

  if payload::text ~* '(customer|phone|full_name|internal_note|created_by|payment)' then
    raise exception 'La RPC pública contiene una clave potencialmente privada: %', payload;
  end if;
end;
$$;

-- 4) Solapamiento reserva vs reserva: el segundo intento debe fallar con exclusion_violation.
do $$
declare
  bid uuid := '10000000-0000-4000-8000-000000000001';
  cid uuid := '20000000-0000-4000-8000-000000000001';
begin
  insert into public.reservations (
    business_id, court_id, start_at, end_at, status, lighting, hourly_rate, total_amount, source
  ) values (
    bid, cid, '2026-10-20 19:00:00-05', '2026-10-20 21:00:00-05',
    'pending', 'with_lights', 60, 120, 'admin'
  );

  begin
    insert into public.reservations (
      business_id, court_id, start_at, end_at, status, lighting, hourly_rate, total_amount, source
    ) values (
      bid, cid, '2026-10-20 20:00:00-05', '2026-10-20 22:00:00-05',
      'pending', 'without_lights', 35, 70, 'admin'
    );
    raise exception 'ERROR: se permitió una reserva solapada';
  exception
    when exclusion_violation then
      null;
  end;
end;
$$;

-- 5) Solapamiento cruzado reserva vs bloqueo también debe fallar en el ledger común.
do $$
declare
  bid uuid := '10000000-0000-4000-8000-000000000001';
  cid uuid := '20000000-0000-4000-8000-000000000001';
begin
  begin
    insert into public.schedule_blocks (
      business_id, court_id, start_at, end_at, status, reason, internal_note
    ) values (
      bid, cid, '2026-10-20 20:30:00-05', '2026-10-20 21:30:00-05',
      'active', 'maintenance', 'DEMO TEST - rollback'
    );
    raise exception 'ERROR: se permitió un bloqueo sobre una reserva';
  exception
    when exclusion_violation then
      null;
  end;
end;
$$;

-- 6) Intervalos adyacentes [inicio, fin) sí son válidos.
insert into public.reservations (
  business_id, court_id, start_at, end_at, status, lighting, hourly_rate, total_amount, source
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '2026-10-20 21:00:00-05', '2026-10-20 22:00:00-05',
  'pending', 'without_lights', 35, 35, 'admin'
);

-- 7) Cancelar libera el intervalo.
update public.reservations
set status = 'cancelled'
where court_id = '20000000-0000-4000-8000-000000000001'
  and start_at = '2026-10-20 19:00:00-05'::timestamptz;

insert into public.schedule_blocks (
  business_id, court_id, start_at, end_at, status, reason, internal_note
) values (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '2026-10-20 19:00:00-05', '2026-10-20 21:00:00-05',
  'active', 'other', 'DEMO TEST - rollback'
);

rollback;
