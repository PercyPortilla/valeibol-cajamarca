# CAXAS STUDIO — constructor visual de páginas hijas (V1)

## Alcance

La plataforma madre mantiene alta de negocio y panel operativo independiente. Después de crear un negocio se ofrece **✦ Diseñar ahora la página**, y desde cada negocio se muestra **✦ Diseñar página** que abre `/admin-global/disenar/<businessId>`.

En el estudio puedes cambiar portada, logo, textos, colores, galería, servicios, orden y visibilidad de secciones. La previsualización en vivo soporta escritorio y móvil. La página pública de cada tenant utiliza los valores guardados de su `business_site_content`; se conservan su nombre y sus canchas y tarifas reales.

## Acceso y guardado

Las lecturas, escrituras y subidas comprueban sesión ADMIN global, UUID válido y la RPC operativa limitada al negocio elegido. El sistema utiliza `admin_update_site_content` de Supabase y Storage `business-gallery/<businessId>/...` con políticas RLS existentes. No se ha agregado service-role ni se han modificado roles, tablas ni RLS de producción.

La configuración editorial se guarda en los campos opcionales del JSONB `theme`. Se conserva la paleta del tenant y los textos de portada y sección no se mezclan entre negocios. Las mutaciones requieren mismo origen, imágenes admitidas de máximo 8 MB y un esquema limitado de contenido.

## Límites expresos de esta versión

- No incorpora drag-and-drop arbitrario ni edición HTML/CSS por parte del usuario.
- No hay sistema independiente de borradores, versiones o reversión: «Guardar cambios» publica el contenido en el negocio cuando su página ya es públicamente visible.
- Un negocio provisional continúa sin aparecer en el catálogo público hasta completar su publicación y canchas en el flujo existente.
- La vista previa representa las secciones editables; no sustituye la página pública real con sus sedes, canchas y contacto. El botón **Canchas y publicación** abre la administración operativa mediante el selector POST protegido existente.

## QA

Verificar TypeScript, ESLint, tests, build, endpoints anónimos y pruebas autenticadas por ADMIN global. No declarar guardado autenticado como validado sin comprobarlo con una sesión real.
