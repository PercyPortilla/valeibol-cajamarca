# CAXAS V3 - Global, propietarios y estilos premium

## Diagnostico del negocio San Sebastian

Verificado en Supabase: 0 sedes, 0 canchas y 0 tarifas. En Precios, el mensaje de vacio ahora explica como ir a Configuracion > Negocio, sedes y canchas para registrar la sede y crear canchas con deporte, horarios y ambas tarifas iniciales. Si una cancha existe sin tarifa, hay formulario para crear su primera regla. No se inventaron precios ni activos.

## Global: equipo y accesos

En /admin-global > Equipo y accesos (por negocio), el ADMIN global puede invitar cuentas por correo o vincular una existente, y asignar rol de propietario adicional, administrador tenant o personal. Puede actualizar roles y desactivar accesos, pero no cambiar el propietario principal: se conserva Recuperar propietario.

La nueva Edge Function platform-business-access requiere JWT valido, user_accounts.role=admin e is_active, y valida el negocio exacto. Utiliza funciones SQL service_role only; nunca expone llaves privilegiadas a navegador. Las cuentas nuevas reciben invitacion Supabase Auth. No se entregan contrasenas ni se crearon usuarios durante el desarrollo.

## Tenant: estudio

El owner y admin tenant tienen acceso a /admin/disenar desde la navegacion y configuracion. El staff queda excluido del constructor. El editor conserva borradores, publicacion explicita, historial y la galeria. Global ADMIN solo opera la pagina hija seleccionada. La invalidacion del micrositio se hace por patron de rutas, sin necesitar el directorio global en la publicacion tenant.

La pantalla clasica de configuracion conserva la edicion rapida original para compatibilidad, que publica directamente. Para borradores y versionado, usar CAXAS STUDIO.

## Cinco estilos de presentacion

Signature, Noir Luxe, Editorial, Stadium y Glass Studio cambian tipografia, fondos, portada, tarjetas y profundidad de las fichas publicas. Se almacenan en el campo JSONB theme.visualStyle, independiente del look de la pagina madre y sin alterar informacion operativa.

## Seguridad / QA

Migraciones: page_builder_tenant_owner_access y platform_team_invites aplicadas en Supabase. Funciones SQL team_* sin grants directos a anon/authenticated, solamente service_role, con protecciones de rol global y negocio. Edge ACTIVE verify_jwt=true. No hubo envios de correo ni modificaciones de perfiles como pruebas.

Por confirmar con sesiones reales: invitar, actualizar rol y publicar un borrador como propietario. Las pruebas automatizadas, build y smoke no reemplazan esas operaciones autenticadas.
