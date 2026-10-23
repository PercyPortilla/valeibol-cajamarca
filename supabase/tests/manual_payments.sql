-- Plataforma global · Bloque 8
\set ON_ERROR_STOP on
begin;

do $$
declare
  public_count integer;
begin
  select count(*) into public_count
  from public.get_public_payment_methods('valeibol-cajamarca');
  if public_count <> 0 then
    raise exception 'FAIL: métodos de pago demo deben iniciar desactivados';
  end if;

  if has_table_privilege('anon', 'public.reservation_payments', 'SELECT')
     or has_table_privilege('authenticated', 'public.reservation_payments', 'INSERT') then
    raise exception 'FAIL: ledger de pagos no debe exponerse directamente';
  end if;
  if not has_function_privilege('authenticated', 'public.report_my_payment(uuid,public.payment_method,text)', 'EXECUTE') then
    raise exception 'FAIL: cliente autenticado necesita RPC de reporte propio';
  end if;
  if has_function_privilege('anon', 'public.report_my_payment(uuid,public.payment_method,text)', 'EXECUTE') then
    raise exception 'FAIL: anon no puede reportar pago como usuario';
  end if;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.report_my_payment(uuid,public.payment_method,text)'::regprocedure) into definition;
  if definition not like '%v_reservation.total_amount%' or definition like '%p_amount%' then
    raise exception 'FAIL: monto del pago debe derivarse de reserva autoritativa';
  end if;
end $$;

rollback;
\echo 'PASS manual_payments.sql · métodos desactivados/ledger/RPC/monto autoritativo'
