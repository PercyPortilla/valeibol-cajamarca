-- SportCenter Caxas: la página madre tiene un único ADMIN global activo.
-- Los propietarios y trabajadores de páginas hijas siguen en public.profiles
-- con permisos limitados a sus respectivos negocios.
-- No modifica usuarios, reservas, precios ni la propiedad de ningún negocio.

do $$
begin
  if (select count(*) from public.user_accounts where role = 'admin' and is_active) > 1 then
    raise exception 'multiple_active_platform_admins_need_review';
  end if;
end
$$;

create unique index if not exists user_accounts_single_active_platform_admin
  on public.user_accounts ((1))
  where role = 'admin' and is_active;

comment on index public.user_accounts_single_active_platform_admin is
  'SportCenter Caxas: una sola cuenta ADMIN global activa; propietarios y staff son perfiles por negocio.';
