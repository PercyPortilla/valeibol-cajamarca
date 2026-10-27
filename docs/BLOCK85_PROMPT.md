# B85 · Header / wordmark premium

## Objetivo

Dar al header de Caxas SportCenter una presencia horizontal más fuerte, profesional y coherente con la identidad metal negro y plata, sin reemplazar el único asset oficial disponible por una recreación CSS.

## Implementación

- Conserva `caxas-sportcenter-logo.webp` como emblema oficial y lo identifica como fallback sustituible mediante `data-brand-asset="emblem-fallback"`.
- Completa el lockup con el wordmark textual `CAXAS SPORTCENTER` y el subtexto `Plataforma deportiva · Cajamarca`.
- El asset mantiene proporción 3:2, `object-fit: contain`, cero recorte y cero deformación.
- El header usa grafito, negro, plata y un filo metálico sutil, con transparencia y blur contenidos.
- La navegación mantiene Explorar, Deportes, Complejos y Mi cuenta con targets de al menos 44 px y foco visible.

## Responsive

- Desktop y tablet conservan branding a la izquierda y navegación a la derecha.
- Móvil apila el lockup y distribuye la navegación en cuatro columnas sin scroll ni overflow horizontal.
- El emblema nunca se comprime; la copia se adapta tipográficamente sin afectar el Hero.
- Reduced motion elimina la transición y el desplazamiento hover del header.

## Fuera de alcance

No modifica B78–B84, backend, Supabase, reservas, autenticación, precios, tenants ni administración. No crea ni inventa un nuevo asset gráfico.
