-- B33 · Supervisión global completa por tenant
--
-- El ajuste previo a B33 permite que el ADMIN global seleccione un tenant y
-- use el mismo actor administrativo que el panel del negocio. Esta migración
-- cierra la última excepción operativa encontrada: Supabase Storage seguía
-- autorizando la galería exclusivamente mediante profiles, por lo que el
-- ADMIN global scoped podía editar contenido pero no subir/reemplazar/borrar
-- imágenes del mismo tenant.
--
-- La política final reutiliza can_manage_business(), que mantiene estas reglas:
--   * OWNER/ADMIN tenant -> solo su negocio activo.
--   * ADMIN global -> solo el negocio seleccionado explícitamente por scope.
--   * STAFF/customer/anon -> sin escritura de galería.

drop policy if exists business_gallery_admin_insert on storage.objects;
create policy business_gallery_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'business-gallery'
  and public.can_manage_business(
    case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then split_part(name, '/', 1)::uuid
      else null
    end
  )
);

drop policy if exists business_gallery_admin_update on storage.objects;
create policy business_gallery_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'business-gallery'
  and public.can_manage_business(
    case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then split_part(name, '/', 1)::uuid
      else null
    end
  )
)
with check (
  bucket_id = 'business-gallery'
  and public.can_manage_business(
    case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then split_part(name, '/', 1)::uuid
      else null
    end
  )
);

drop policy if exists business_gallery_admin_delete on storage.objects;
create policy business_gallery_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'business-gallery'
  and public.can_manage_business(
    case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then split_part(name, '/', 1)::uuid
      else null
    end
  )
);

comment on function private.platform_admin_selected_business_id() is
  'Scope explícito del ADMIN global: honra x-platform-business-id solo para una cuenta ADMIN global activa y un tenant existente.';
