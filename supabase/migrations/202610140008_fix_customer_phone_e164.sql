-- Valeibol · corrección E.164 validada contra PostgreSQL real
alter table public.customers
  drop constraint if exists customers_phone_e164_check;

alter table public.customers
  add constraint customers_phone_e164_check
  check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$');
