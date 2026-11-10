# CAXAS SportCenter · Chrome Violet

## Solicitud

El usuario seleccionó el logotipo **CAXAS / SPORTCENTER** de metal cromado, letras
puntiagudas y detalles violetas, y pidió sustituir el verde grafito/lima de la web
por una identidad coherente con el nuevo logo.

## Identidad publicada

- **Imagen original aprobada** `public/images/caxas-chrome-violet-master.png`, 2172×724 px.
- **Wordmark para cabeceras** `public/images/caxas-chrome-violet-wordmark.webp`, 2007×298 px, recorte del arte original, optimizado a unos 116 KB.
- Componente reutilizable `components/brand/CaxasChromeBrand.tsx` usado en `PlatformHeader`, `PlatformFooter` y `PlatformAdminBrand`. SPORTCENTER y el descriptor siguen siendo texto HTML para legibilidad responsive y accesibilidad.
- Favicon `app/icon.svg`: X metálica con diagonal violeta sobre fondo negro.
- Paleta: negro `#0a0910`, grafito neutro `#17131f`, plata `#e3e6f0`, violeta `#bd7aff`, hover `#dfbbff`, foco `#d2a7ff`.

## Scope y límites

- `app/styles/caxas-premium-2026.css`: la portada sustituye acentos lima, tintes verdes de fondos, chips, formularios, tarjetas, enlaces y footer por cromo-violeta.
- `app/styles/caxas-children-premium-2026.css`: fichas genéricas, reserva, deportes, portada Valeibol, portal propietario, login y consola global reciben paleta sin verde corporativo.
- `app/styles/caxas-chrome-violet-2026.css`: identidad visual y navegación compartidas, importadas al final de `app/globals.css`.
- Las capas antiguas `globals-1..5.css` y los tokens `themeCssVariables` del propietario **no se modificaron**. Valeibol conserva su marca propia y su paleta editable; únicamente se retocaron las superficies corporativas Caxas que lo rodean.
- No se tocaron Supabase, RLS, auth, datos reales de negocios, disponibilidad, precios, lógica de reservas ni geometría/interactividad del complejo 3D. Césped verde, indicadores de disponibilidad y botón verde oficial de WhatsApp permanecen por significado funcional.

## QA

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm test`: **628 tests / 628 PASS**, incluyendo cuatro controles nuevos de identidad, activos y aislamiento.
- `npm run build`: PASS con Next.js 16.4.3; 31 páginas estáticas generadas.
- Chrome CDP con viewport CSS 1440, 390 y 360 para `/`, `/buscar`, `/voley`, `/complejo/valeibol-cajamarca`, `/reservar?negocio=valeibol-cajamarca` y `/admin/login`. En las vistas 390/360, `scrollWidth===innerWidth`; las geometrías internas del diorama y el menú horizontal dentro de Valeibol pueden extenderse **dentro de contenedores recortados/desplazables**, sin overflow de documento. El wordmark carga con `naturalWidth>0`; CTA corporativo calculado `rgb(189,122,255)`.
- Capturas de QA `qa-premium-caxas/children-*.png` no se incorporan al Git.
- No hubo QA visual autenticado del panel privado de propietarios o de la consola global; las pruebas de permisos y compilación sí se ejecutaron. No se inventaron credenciales.

## Recomendación posterior

Cuando el negocio cuente con fotografías Valeibol de mayor resolución, reemplazar el hero de baja definición **solo con fotos reales** proporcionadas por el negocio. Esto no bloquea el nuevo logo ni la paleta cromada.
