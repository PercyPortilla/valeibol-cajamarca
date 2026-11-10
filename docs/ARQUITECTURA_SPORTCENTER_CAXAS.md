# Arquitectura de acceso · SportCenter Caxas

## Página madre

SportCenter Caxas es el catálogo principal y su panel global está en /admin-global.
Existe una sola cuenta ADMIN global activa. Desde ahí se crean páginas hijas,
se activan o desactivan negocios y se supervisan sedes, canchas y estadísticas.
La migración single_global_platform_owner evita una segunda cuenta global activa.

## Páginas hijas

Cada complejo posee /complejo/[slug] como página pública y /admin como panel
privado. Los perfiles owner, admin de negocio y staff están asociados a su
business_id y tienen permisos limitados a ese negocio. /propietario reúne las
herramientas del dueño. El administrador global puede supervisar una hija
mediante la selección explícita /api/admin-global/select-business.
Esta selección no concede acceso global a dueños o trabajadores de hijas.

/admin/login es la entrada privada de gestores y /admin/activar sirve para
invitaciones y recuperación de contraseña.

## Público sin cuentas

Los visitantes exploran la madre, las páginas hijas y los horarios sin login.
Para cada bloque disponible, un enlace abre el WhatsApp publicado por el
negocio con cancha, fecha y horario en el mensaje. La confirmación ocurre en
WhatsApp: abrir el chat no genera ni confirma una reserva automática.

El modo PUBLIC_WHATSAPP_ONLY desactiva el endpoint de reserva pública con
HTTP 410 y redirige /mi-cuenta al catálogo. Las reservas históricas continúan
en la base de datos. Si una hija no publica un WhatsApp, no se inventa un número.

## Condiciones de publicación

Los cambios están preparados localmente y requieren publicación en Vercel y
aplicación de la migración para entrar en vigor. Las funciones
platform-business-onboarding y platform-owner-recovery también deben
publicarse desde el repositorio para que funcionen el alta y la recuperación
de propietarios. La plataforma puede leer sus propios datos de operación,
pero no las conversaciones privadas de WhatsApp.
