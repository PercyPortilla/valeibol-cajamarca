-- Valeibol · endurecimiento de lectura pública de contenido
-- No exponer elementos ocultos del editor administrativo.

create or replace function public.get_public_site_content(p_business_slug text)
returns table (
  business_id uuid,
  services jsonb,
  gallery jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    b.id,
    coalesce((
      select jsonb_agg(item order by coalesce((item->>'sortOrder')::integer, 0))
      from jsonb_array_elements(coalesce(c.services, '[]'::jsonb)) item
      where coalesce((item->>'isVisible')::boolean, true)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(item order by coalesce((item->>'sortOrder')::integer, 0))
      from jsonb_array_elements(coalesce(c.gallery, '[]'::jsonb)) item
      where coalesce((item->>'isVisible')::boolean, true)
    ), '[]'::jsonb),
    c.updated_at
  from public.businesses b
  left join public.business_site_content c on c.business_id = b.id
  where b.slug = p_business_slug and b.is_active
  limit 1;
$$;

revoke all on function public.get_public_site_content(text) from public;
grant execute on function public.get_public_site_content(text) to anon, authenticated;
