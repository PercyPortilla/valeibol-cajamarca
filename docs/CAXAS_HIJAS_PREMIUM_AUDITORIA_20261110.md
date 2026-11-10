# Caxas SportCenter · fase premium de páginas hijas

Fecha: 10/11/2026. Código base: `a8ff0b2` (página madre premium).

## Alcance

- Ficha pública genérica de complejo `/complejo/[slug]` y portadas de deportes.
- Ficha histórica de Valeibol, independiente de los estilos de la página madre.
- Consulta de horarios `/reservar` y calendario público compartido.
- Portal propietario, pantalla de acceso privado, consola global y mejoras tipográficas en shell administrativo de negocios.

## Hallazgos y medidas

1. **Identidad dispersa.** Las hijas presentaban una estética diferente de la nueva portada. Se añadió `app/styles/caxas-children-premium-2026.css`, importada al final, con scopes por superficie. No modifica geometría/control del diorama ni la lógica de inventario.
2. **Consulta comercial ambigua.** Se armonizó el copy como consulta por WhatsApp, se explicó que abrir el chat no crea una reserva y se añadieron pasos visibles y navegación al negocio.
3. **Valeibol podía mostrar fotografías que el propietario ocultó.** El fallback de dos fotos de referencia solo se aplica con configuración `default`; si la configuración del tenant está presente y no hay fotos visibles, no se imprime la galería ni su navegación.
4. **Contacto divergente.** Hero, ubicación y footer de Valeibol ahora usan el teléfono público normalizado con el mismo origen que el calendario; sin teléfono disponible se omiten links de llamada/chat.
5. **Servicios vacíos.** La sección y su navegación se ocultan si el negocio no publicó servicios visibles.
6. **Agenda en pasado.** La navegación de semana no retrocede antes de la semana actual; los tabs solo referencian el panel montado.
7. **Jerarquía semántica.** Se ordenaron títulos de sedes y canchas.
8. **Admin.** Ajustes de presentación, legibilidad y jerarquía manteniendo el tema dinámico de cada tenant y sus permisos existentes. No se tocó backend ni Supabase.
9. **QA residual.** Se excluyeron directorios locales de capturas y perfil Chrome del análisis ESLint, sin versionar esos artefactos.

## Límites honestos

- Las imágenes originales de Valeibol son pequeñas (wide 600×261 y portrait 235×510); conviene sustituirlas por fotografías reales HD proporcionadas por el negocio para ganar nitidez sin falsificar instalaciones.
- La recuperación de contraseña conserva una transición heredada al antiguo dominio por compatibilidad del flujo Supabase PKCE. No se cambió el redirect ni la allowlist en esta fase.
- Los datos de horarios, tarifas, contacto y reseñas siguen teniendo su fuente original; ningún negocio o precio se inventó.
- El diseño de páginas administrativas protegidas puede verificarse por código/tests, pero su QA visual autenticado requiere sesión autorizada. No se simulan credenciales.

## Criterios de entrega

- `npm run typecheck` PASS.
- `npm run lint` PASS; perfiles Chrome locales excluidos de ESLint.
- `npm test`: **624/624 PASS** (619 heredadas y 5 nuevas).
- `npm run build`: Next.js 16.4.3 PASS; 31 páginas estáticas generadas.
- CDP Chrome sobre localhost, anchos CSS de 360/390/1440: inicio, Valeibol, consulta y login, con `scrollWidth === innerWidth` en móvil para las cuatro rutas; la navegación horizontal de Valeibol está dentro de su contenedor y tiene desplazamiento propio.
- Capturas QA locales: `qa-premium-caxas/children-*.png` (no versionadas).
- El entorno local no pudo cargar agenda/auth reales por su propia configuración, por lo que la inspección visual de esos estados no sustituye las pruebas de producción ni un login autorizado.
