-- Plataforma global · Bloque 18
\set ON_ERROR_STOP on
begin;

do $$
declare
  definition text;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'business_favorites' and c.relrowsecurity
  ) then raise exception 'FAIL: business_favorites debe tener RLS'; end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'business_reviews' and c.relrowsecurity
  ) then raise exception 'FAIL: business_reviews debe tener RLS'; end if;

  if has_table_privilege('anon', 'public.business_reviews', 'SELECT')
     or has_table_privilege('authenticated', 'public.business_reviews', 'INSERT')
     or has_table_privilege('authenticated', 'public.business_reviews', 'UPDATE')
     or has_table_privilege('authenticated', 'public.business_reviews', 'DELETE') then
    raise exception 'FAIL: reviews no admite acceso directo';
  end if;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'business_reviews'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) like '%FOREIGN KEY (reservation_id)%ON DELETE CASCADE%'
  ) then
    raise exception 'FAIL: review debe seguir el ciclo de vida de reservation con ON DELETE CASCADE';
  end if;

  select pg_get_functiondef('public.submit_verified_business_review(uuid,smallint,text)'::regprocedure) into definition;
  if definition not like '%auth.uid()%' or definition not like '%r.status = ''completed''%' or definition like '%p_user_id%' then
    raise exception 'FAIL: submit review no deriva identidad/completed correctamente';
  end if;

  select pg_get_functiondef('public.get_public_business_reviews(text,integer)'::regprocedure) into definition;
  if definition not like '%rv.status = ''published''%' or definition like '%rv.comment%' or definition like '%user_id%' or definition like '%customer_id%' then
    raise exception 'FAIL: reviews públicas deben ser published y sin texto libre/identidad';
  end if;

  select pg_get_functiondef('public.platform_admin_moderate_review(uuid,public.review_moderation_status)'::regprocedure) into definition;
  if definition not like '%is_platform_admin()%' then
    raise exception 'FAIL: moderación debe exigir ADMIN global';
  end if;

  select pg_get_functiondef('public.admin_complete_reservation(uuid)'::regprocedure) into definition;
  if definition not like '%status <> ''confirmed''%' or definition not like '%end_at > now()%' or definition not like '%status = ''completed''%' then
    raise exception 'FAIL: completed debe ser confirmed y posterior al fin';
  end if;
end $$;

rollback;
\echo 'PASS platform_engagement.sql · favoritos privados/reviews verificadas/moderación global/completed'
