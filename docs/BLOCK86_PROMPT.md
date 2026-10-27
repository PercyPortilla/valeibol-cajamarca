# B86 · Superficies públicas premium

## Objetivo

Unificar las rutas públicas restantes con la identidad negra, grafito y plata de Caxas SportCenter sin modificar su lógica, datos, estados, permisos ni flujos transaccionales.

## Alcance visual

- `/complejo/[slug]`: ficha genérica con header B85 y landing Valeibol con su navegación tenant preservada bajo la misma paleta oscura.
- `/reservar`: Hero, calendario, estados y diálogo de solicitud con superficies grafito y controles metálicos.
- `/mi-cuenta` y `/mi-cuenta/recuperar`: autenticación, historial, favoritos, reseñas, notificaciones, formularios y estados vacíos conservados sobre una carcasa premium.
- `/propietario`: únicamente la carcasa pública incorpora header B85, footer global y superficies oscuras; los enlaces siguen entrando a las rutas administrativas existentes.

## Accesibilidad y responsive

- Controles con targets mínimos de 44 px, foco visible dorado y contraste claro.
- Adaptación a desktop, tablet y móvil sin overflow horizontal.
- Reduced motion neutraliza desplazamientos decorativos.

## Fuera de alcance

No modifica backend, Supabase, RLS, autenticación, reservas, pricing, estados, permisos, tenants, `/admin` ni `/admin-global`.
