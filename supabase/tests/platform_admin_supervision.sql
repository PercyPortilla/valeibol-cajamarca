-- Caxas Sport Center · Bloque 33
-- Supervisión global completa por tenant sin crear profiles artificiales.
\set ON_ERROR_STOP on
begin;

do $$
declare
  policy_sql text;
begin
  select lower(coalesce(string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), ' '), ''))
  into policy_sql
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'business_gallery_admin_insert',
      'business_gallery_admin_update',
      'business_gallery_admin_delete'
    );

  if policy_sql not like '%can_manage_business%'
     or policy_sql like '%public.profiles%' then
    raise exception 'FAIL: Storage gallery no usa autorización tenant central';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname in ('business_gallery_admin_insert','business_gallery_admin_update','business_gallery_admin_delete')) <> 3 then
    raise exception 'FAIL: faltan políticas de galería B33';
  end if;
end $$;

do $$
declare
  manage_def text;
  actor_def text;
begin
  select lower(pg_get_functiondef('public.can_manage_business(uuid)'::regprocedure)) into manage_def;
  select lower(pg_get_functiondef('public.phase6_admin_actor()'::regprocedure)) into actor_def;

  if manage_def not like '%platform_admin_selected_business_id()%'
     or actor_def not like '%platform_admin_selected_business_id()%'
     or actor_def not like '%''admin''::public.app_role%' then
    raise exception 'FAIL: B33 requiere scope global central vigente';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.can_manage_business(uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon no debe poder ejecutar can_manage_business';
  end if;
end $$;

rollback;
\echo 'PASS platform_admin_supervision.sql · Storage + tenant scope B33'
