-- Fix production regressions discovered from live logs and transactional validation.
-- 1) Regexes in booking/admin functions were over-escaped.
-- 2) admin_update_site_content used an ambiguous ON CONFLICT column name.
-- 3) Remove the demo suffix from the live court display name.

do $fix$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_public_reservation_request',
        'admin_create_manual_reservation',
        'admin_edit_reservation'
      )
  loop
    definition := pg_get_functiondef(fn.oid);
    definition := replace(definition, $q$'\\s+'$q$, $q$'[[:space:]]+'$q$);
    definition := replace(definition, $q$'\s+'$q$, $q$'[[:space:]]+'$q$);
    definition := replace(definition, $q$'^\\+[1-9][0-9]{7,14}$'$q$, $q$'^[+][1-9][0-9]{7,14}$'$q$);
    definition := replace(definition, $q$'^\+[1-9][0-9]{7,14}$'$q$, $q$'^[+][1-9][0-9]{7,14}$'$q$);
    execute definition;
  end loop;

  select pg_get_functiondef('public.admin_update_site_content(jsonb,jsonb,jsonb)'::regprocedure)
    into definition;
  definition := replace(
    definition,
    'on conflict (business_id) do update set',
    'on conflict on constraint business_site_content_pkey do update set'
  );
  execute definition;
end;
$fix$;

update public.courts
set name = 'Cancha principal',
    updated_at = now()
where business_id = '10000000-0000-4000-8000-000000000001'
  and id = '20000000-0000-4000-8000-000000000001'
  and name <> 'Cancha principal';
