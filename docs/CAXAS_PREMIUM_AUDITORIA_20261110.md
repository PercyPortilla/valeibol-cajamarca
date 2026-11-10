# SportCenter Caxas — auditoría y mejora visual premium

Fecha: 10 de noviembre de 2026. Alcance: página madre y claridad editorial de búsqueda. La arquitectura Next.js 16 + Supabase y los permisos de administración global e hijas se conservan. Los visitantes no requieren registro; la coordinación se realiza por WhatsApp.

## Dirección visual

**Arena editorial de Cajamarca:** grafito profundo y verde oscuro, blanco cálido (#f5f5ee) y acento lima (#d9f675) en acciones y selecciones. El complejo multideporte interactivo es el visual protagonista. La fotografía publicada de Valeibol da autenticidad a la primera ficha. No se inventan negocios, reseñas ni precios.

Las adaptaciones visuales de portada están aisladas en app/styles/caxas-premium-2026.css bajo el selector .platform-home. Las cinco hojas preexistentes conservan sus reglas y las páginas hijas mantienen su identidad.

## Hallazgos y correcciones

| Prioridad | Hallazgo | Corrección |
| --- | --- | --- |
| Alta | Título y navegación recortados en capturas móviles | Nueva rejilla móvil, título equilibrado y navegación 2x2 |
| Alta | Diorama se mezclaba con el buscador | Diorama en marco arquitectónico y búsqueda separada |
| Alta | Tipografía de acciones/estadísticas demasiado pequeña | Escala de fuente y contraste mejorados en la home |
| Alta | Fecha y hora parecían filtros de disponibilidad real | Texto explícito: son orientativas; confirmar por WhatsApp |
| Alta | Indicador nocturno atribuía iluminación sin verificar | Mensaje para consultar iluminación al negocio |
| Media | Tarjetas deportivas muy compactas | Tarjetas editoriales amplias y selección 3D preservada |
| Media | Un negocio único dejaba hueco en el catálogo | Tarjeta protagonista con fotografía publicada real |
| Media | Listado de 6 complejos sin salida a la lista completa | Enlace condicional al total de complejos |
| Media | Jerarquía de encabezados en las fichas | H3 en tarjetas de la página madre |
| Media | Fecha antigua seleccionable en la portada | Selector con mínimo del día local de Cajamarca |
| Alta | Falla de lectura de Supabase aparecía como ausencia real de canchas | Resultado con estado de error separado, mensaje y acción para reintentar |

## Verificación

TypeScript, ESLint, pruebas automatizadas y compilación Next.js; capturas locales en Chrome; DevTools emuló 360 y 390 CSS px con documento de igual ancho al viewport, sin desbordamiento horizontal. Confirmar además el comportamiento en producción después de desplegar.

## Límite

La búsqueda global aún no calcula disponibilidad por fecha/hora. La agenda de una cancha concreta y la conversación de WhatsApp son las vías de confirmación de horario. No se modificó el solver 3D, las reservas, las cuentas ni la configuración de Supabase.
