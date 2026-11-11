# CAXAS STUDIO V2 · Constructor visual, borradores e historial

## Implementación

**Acceso:** administrador global en `/admin-global` → «Diseñar página» de un negocio concreto.

**Plantillas:** Fútbol, vóley, básquet y multideporte. Aplicar una plantilla solo actualiza la copia de trabajo y conserva logos, fotos, servicios y canchas reales; modifica paleta/estructura/textos neutros. No afirma tener instalaciones ni servicios que no existan.

**Bloques:** bloques nativos «Servicios» y «Galería» más hasta ocho secciones editoriales de texto/foto/botón HTTPS. Reordenación por arrastrar/soltar o flechas accesibles, visibilidad, edición y eliminación. La portada, las canchas reales, sus precios y reseñas permanecen fijos y no se inventan desde el editor.

**Edición de contenido:** logo, galería, servicios, portada, encabezados, colores, bloques. Vista previa escritorio/móvil. Las imágenes se suben a Storage por tenant con el mismo control que V1, pero no se muestran públicamente hasta publicar la configuración que las referencia.

## Borrador y publicación separados

1. «Guardar borrador» llama a `POST /api/admin-global/page-builder/[businessId]`. Persiste exclusivamente en `private.platform_page_builder_drafts`; no cambia `business_site_content`.
2. «Publicar diseño» llama a `PUT`, comprobando versión de borrador y timestamp de la configuración pública. Actualiza el contenido usando la RPC validada existente `admin_update_site_content` y registra una publicación en `private.platform_page_builder_revisions`.
3. «Versiones» permite recuperar una publicación como **borrador** por `PATCH`; la página pública no se altera hasta publicar de nuevo.
4. «Descartar borrador» por `DELETE` vuelve al contenido ya publicado sin tocarlo.
5. Se conservan las últimas veinte publicaciones por negocio. La primera publicación conserva también una copia del diseño público anterior, si existe.

## Garantías de permisos y consistencia

- Todo CRUD requiere la sesión **ADMIN global activa**, el **businessId** exacto en el ámbito validado por PostgreSQL y una solicitud del mismo origen.
- Las tablas de borradores y revisiones están en esquema privado, con RLS activo, sin permisos de acceso directo a `anon` ni `authenticated`. Solo las funciones RPC verificadas pueden acceder.
- `auth.uid()`, `is_platform_admin()` y `private.platform_admin_selected_business_id()` se comprueban en PostgreSQL en **cada** operación.
- Concurrencia optimista: `draftVersion` impide pisar cambios de otra pestaña. `based_on_updated_at` bloquea una publicación si el propietario modificó el contenido público desde que se preparó el borrador.
- Ante un conflicto, se conserva el borrador; el administrador puede revisarlo o descartarlo para cargar el contenido actual. No existe publicación forzada automática.
- Las operaciones de borrador no tocan las reservas, tarifas, pagos, usuarios ni roles. Publicación no activa un negocio todavía provisional.

## Alcances todavía no incluidos

- No incluye maquetación libre de CSS/HTML ni controles de cada píxel; las secciones se componen con componentes seguros.
- No permite mover la portada, el catálogo real de canchas o las reseñas, para evitar datos operativos inconsistentes.
- La vista previa es una composición aproximada de las secciones editables y no reemplaza una revisión del sitio público.
- La prueba completa de **guardar/publicar** debe ejecutarse desde una sesión real del administrador global, nunca con contraseñas compartidas.

## Datos y migración

Archivo local: `supabase/migrations/20261111112500_caxas_studio_v2_drafts_revisions.sql`.

Supabase: migración **`20261111163859_caxas_studio_v2_drafts_revisions`** aplicada; sin cambios destructivos ni migración de contenido de negocios. El endpoint V1 que antes publicaba directamente ahora guarda en borrador, por lo que el front y la migración deben desplegarse conjuntamente (la migración es retrocompatible con V1).

## Verificación

Ejecutar: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; en producción verificar rutas autenticadas y rechazo anónimo/cross-origin, luego efectuar un guardado de borrador y confirmar que la página pública no cambió; publicar y comprobar que sí cambia, crear segunda versión y recuperar la anterior como borrador.
