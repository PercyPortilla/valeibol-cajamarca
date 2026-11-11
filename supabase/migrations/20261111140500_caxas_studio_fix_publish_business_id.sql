-- Fix CAXAS STUDIO publish failure 42702: PL/pgSQL confuses the
-- RETURNS TABLE(business_id ...) output parameter with the upsert conflict column.
-- The legacy owner/tenant RPC's security, validation, signature, grants and
-- operational behavior stay unchanged. No data rows are modified.
do $fix_publish_business_id$
declare
  v_definition text;
  v_old text := 'on conflict (business_id) do update set';
  v_new text := 'on conflict on constraint business_site_content_pkey do update set';
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_update_site_content'
    and pg_get_function_identity_arguments(p.oid) =
      'p_logo_url text, p_services jsonb, p_gallery jsonb, p_theme jsonb';

  if v_definition is null then
    raise exception 'Expected admin_update_site_content signature is missing';
  end if;

  if strpos(lower(v_definition), v_new) > 0 then
    return; -- Already patched (safe on rerun).
  end if;

  if strpos(lower(v_definition), v_old) = 0 then
    raise exception 'Unexpected admin_update_site_content upsert; review before changing';
  end if;

  -- Replace just the unique constraint conflict target, avoiding ambiguity
  -- with the TABLE-returning function's business_id output parameter.
  execute replace(v_definition, v_old, v_new);
end;
$fix_publish_business_id$;
