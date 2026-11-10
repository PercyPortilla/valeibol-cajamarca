# CAXAS SportCenter · Continuidad premium por rutas, tenants y administración

**Fecha:** 10 de noviembre de 2026
**Base de trabajo:** commit `58c0f13`, identidad madre Chrome Violet.

## Origen: revisión de siete capturas del usuario

1. La portada `/` fue aprobada visualmente; al abrir `/buscar` y rutas de deportes se perdían jerarquía, cromática y continuidad.
2. Las tarjetas deportivas mostraban iconos genéricos y repetidos, especialmente fútbol/futsal.
3. Valeibol heredaba el violeta de Caxas, aunque cada complejo debe preservar su identidad propia y su configuración editable.
4. Al navegar se veía la pantalla azul de carga heredada.
5. La consola ADMIN global era funcional pero se percibía como una colección plana de métricas y formularios.

## Acciones implementadas

### Experiencia pública

- `app/styles/caxas-experience-2026.css` presenta búsqueda y landings deportivas con fondo grafito-violeta neutro, títulos, tarjetas, botones, filtros y un pie de página acordes con el estándar Chrome Violet.
- El encabezado de búsqueda utiliza una cuadrícula **2×2 a 680 px o menos** para que «Consultar canchas» sea totalmente visible; comprobado con Chrome CDP.
- `components/platform/SportEmblem.tsx` introduce cuatro SVG vectoriales distintos (vóley, fútbol, futsal, básquet), aplicados en `HomeSportExperience`, con tamaños, colores y halos consistentes. El deporte real y el número real de canchas siguen viniendo del catálogo.
- El enlace del catálogo completo se convierte a `next/link` para reducir recargas de navegación.

### Estados de transición

- `app/loading.tsx`, `app/admin/(protected)/loading.tsx` y `app/complejo/[slug]/loading.tsx` comparten `RouteLoading`, con skeleton y movimiento respetando `prefers-reduced-motion`.
- Se cambia el fondo base de transición, antes azul `#071a2b`, a grafito `#0a0910`. Los contextos platform/tenant/admin usan variantes diferenciadas.
- **Límite:** esto resuelve la carga visible entre rutas; no modifica las mallas ni los fondos por deporte dentro de la escena 3D persistente, que puede conservar colores físicos o deportivos.

### Identidad de cada hija

- `app/styles/caxas-tenant-independence-2026.css` evita heredar el acento violeta corporativo. **Valeibol** utiliza sus variables publicadas `--brand-blue`, `--brand-red`, `--brand-yellow`, con cabecera azul, CTA rojo y acentos dorados, manteniendo su logo real.
- Las fichas genéricas de otros complejos usan un sistema neutral si no hay tema configurado y sus variables editables `themeCssVariables(siteContent.theme)` cuando sí existe. La identidad del complejo no se toma de la madre.
- No se cambian las preferencias almacenadas en Supabase ni los permisos de edición del tenant.

### Consola ADMIN global

- La portada ejecutiva `app/admin-global/page.tsx` cuenta ahora con jerarquía superior, navegación entre secciones, cinco KPIs ilustrados, barra de porcentaje de negocios activos y un desglose por disciplinas.
- **Las cantidades proceden exclusivamente de RPC ya existentes**: `get_platform_admin_summary`, `get_platform_admin_businesses_page` y `get_platform_admin_sports`. No se simulan ingresos, tendencias ni avisos de servicio.
- El gráfico por deporte muestra `activeCourtCount` del catálogo global y lo describe como **canchas habilitadas**, no como disponibilidad en tiempo real.
- El formulario de onboarding conserva el mismo `submit`, nueve campos y controles de seguridad, ahora agrupados en identidad, propietario y operación.
- Se conserva `requirePlatformAdminContext`, sin escribir en RLS/Auth, crear nuevos accesos ni consultar datos privados extra.

## Validación realizada

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: **634 pruebas / 634 PASS**, incluyendo seis controles nuevos de continuidad.
- `npm run build`: PASS, Next.js 16.4.3, 31 páginas estáticas.
- QA visual Chrome CDP a 1440/390/360 px para `/`, `/buscar`, `/voley`, `/complejo/valeibol-cajamarca`, `/reservar`, `/admin/login`: `scrollWidth === innerWidth` en 360/390; logo cargado en rutas de marca; color rojo del CTA de Valeibol medido como `rgb(183,47,52)`; CTA madre violeta `rgb(189,122,255)`.
- QA adicional de las cuatro tarjetas de deportes en 1440/390/360: iconos vectoriales visibles, tamaños táctiles y jerarquía aprobados.
- Imágenes y logs de QA permanecen localmente en `qa-premium-caxas/` y no se versionan.

## Límites e instrucciones posteriores

- La consola global sigue protegida: no se abre con una cuenta simulada para QA. La inspección de pantallas administrativas protegidas fue de estructura, CSS, datos tipados, test y build; requiere sesión real autorizada para QA visual autenticado.
- Disponibilidad por fecha/hora y confirmación de reservas siguen obedeciendo al flujo WhatsApp-only vigente.
- Los temas por tenant se personalizan con datos del propietario; sin información de marca de un negocio nuevo, la ficha genérica permanece neutra. No se inventan logos, servicios, precios, reseñas ni colores de marca definitivos.
- La composición y geometría del complejo deportivo 3D se conservan; las transiciones propias de la escena son distintas del estado de carga de navegación.
