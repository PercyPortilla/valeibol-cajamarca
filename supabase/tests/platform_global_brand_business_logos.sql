-- B61 · contrato de marca global, logos por negocio y reparación de nombres deportivos.
\set ON_ERROR_STOP on
begin;

do $$
declare
  catalog_fn text;
  admin_fn text;
  public_content_fn text;
begin
  select lower(pg_get_functiondef('public.get_public_platform_catalog(text,text)'::regprocedure)) into catalog_fn;
  select lower(pg_get_functiondef('public.admin_update_site_content(text,jsonb,jsonb,jsonb)'::regprocedure)) into admin_fn;
  select lower(pg_get_functiondef('public.get_public_site_content(text)'::regprocedure)) into public_content_fn;

  if catalog_fn not like '%site_content.logo_url%'
     or catalog_fn not like '%b.configuration_status = ''confirmed''%'
     or catalog_fn not like '%lower(coalesce(v.city, b.city, '''')) = ''cajamarca''%'
  then
    raise exception 'FAIL: B61 public catalog logo/readiness scope incomplete';
  end if;

  if admin_fn not like '%phase6_admin_actor()%'
     or admin_fn not like '%v_actor.role not in (''owner'', ''admin'')%'
     or admin_fn not like '%invalid_logo_url%'
     or admin_fn like '%p_business_id%'
  then
    raise exception 'FAIL: B61 admin logo update scope incomplete';
  end if;

  if public_content_fn not like '%c.logo_url%'
     or public_content_fn not like '%b.configuration_status = ''confirmed''%'
  then
    raise exception 'FAIL: B61 public site content logo contract incomplete';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon', 'public.admin_update_site_content(text,jsonb,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'FAIL: anon can update B61 site content';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_update_site_content(text,jsonb,jsonb,jsonb)', 'EXECUTE') then
    raise exception 'FAIL: authenticated lacks B61 admin update RPC';
  end if;
  if not has_function_privilege('anon', 'public.get_public_platform_catalog(text,text)', 'EXECUTE') then
    raise exception 'FAIL: anon lacks B61 public catalog';
  end if;
end $$;

rollback;
\echo 'PASS platform_global_brand_business_logos.sql · B61'
