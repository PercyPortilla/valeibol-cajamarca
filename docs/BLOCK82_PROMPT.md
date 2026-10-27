# BLOCK82 · Búsqueda premium continua

## Objetivo

Eliminar la ruptura visual que ocurría al pulsar `Explorar espacios` desde Home o desde una landing deportiva. `/buscar` deja de montar el header blanco y el hero azul legacy y pasa a formar parte de la misma experiencia metal negro + plata.

## Alcance implementado

- Header premium en `/buscar`.
- Hero oscuro con acento contextual por deporte.
- Panorama B79/B80 enfocado en el deporte filtrado y con iluminación real de Cajamarca.
- Buscador existente reestilizado en metal/grafito sin cambiar parámetros ni backend.
- Resultados continúan usando datos reales y `BusinessCard` premium.
- Filtros activos, mapa, lista de ubicaciones, empty state y footer adaptados a fondo oscuro.
- Responsive móvil/tablet y focus/reduced motion preservados.

## Preservado

- `deporte`, `fecha`, `hora` y cobertura fija de Cajamarca.
- `noindex` para facetas filtradas y canonical de `/buscar` sin filtros.
- Catálogo, Supabase, reservas y lógica de iluminación comercial.

## Fuera de alcance

- Nuevo render fotográfico definitivo de las canchas.
- Rediseño de Mi cuenta, Reserva, Propietario o detalle de complejo.
- Commit, push o deploy hasta completar QA y recibir continuidad del usuario.
