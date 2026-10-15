# Valeibol · contenido público administrable

La pantalla `/admin/configuracion` permite a owner/admin gestionar el contenido comercial que aparece en la portada.

## Servicios

- editar nombre, descripción e icono;
- cambiar el orden;
- mostrar u ocultar;
- agregar o quitar elementos;
- restaurar la lista base de servicios confirmados por el negocio.

La lista base incluye cancha techada, reserva por hora, iluminación opcional, zona de cooling break, música a elección, zona TV, tienda de bebidas y snacks, baños para hombres y mujeres, vestidores, zona para público, altura de malla a elección y balones profesionales.

## Galería

- agregar o quitar fotos;
- ordenar y ocultar elementos;
- editar título y texto alternativo;
- pegar una URL HTTPS;
- subir JPG, PNG, WebP o AVIF de hasta 8 MB.

En producción las subidas se guardan en el bucket público `business-gallery` de Supabase Storage. La escritura está restringida por RLS a owner/admin y al prefijo del `business_id` del usuario autenticado. La web pública solo recibe elementos marcados como visibles.

En `localhost`, el login `admin / 12345` usa el repositorio local de desarrollo. Las fotos subidas se guardan temporalmente en `public/uploads/local-gallery/`, una ruta ignorada por Git, y los cambios de contenido se reinician cuando se reinicia el proceso de desarrollo.

## Precios y disponibilidad

Los precios mantienen su módulo dedicado `/admin/precios`, con versionado de vigencias. La disponibilidad y bloqueos se administran desde `/admin/disponibilidad`. Configuración enlaza ambos módulos para no duplicar lógica autoritativa.

## WhatsApp

No existe una opción de configuración de WhatsApp en la navegación administrativa. El contacto público por `wa.me` continúa disponible, pero la configuración técnica de mensajería no forma parte de esta interfaz.
