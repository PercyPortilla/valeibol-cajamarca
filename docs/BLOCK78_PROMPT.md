# BLOCK78 · Selección deportiva integrada en Home

## Objetivo

Evitar que las tarjetas de “¿Qué quieres jugar?” abandonen la experiencia premium de Home y abran las landings deportivas legacy. Las tarjetas y el selector superior deben controlar el mismo deporte activo dentro del Hero.

## Alcance implementado

- Se añadió `HomeSportExperience` como controlador cliente del deporte activo.
- `HomeHero` pasó a recibir `sportSlug` y `onSportChange` de forma controlada.
- Las tarjetas deportivas de Home dejaron de ser enlaces a `/voley`, `/futbol`, `/futsal` y `/basquet`.
- Cada tarjeta es ahora un botón accesible con `aria-pressed` y estado visual activo.
- Al seleccionar una tarjeta se actualiza inmediatamente el render deportivo del Hero y la vista vuelve al Hero con desplazamiento suave.
- `prefers-reduced-motion` cambia ese desplazamiento a comportamiento inmediato.
- Las landings deportivas legacy permanecen disponibles para acceso directo, sitemap y SEO; B78 no las elimina ni las rediseña.

## Fuera de alcance

- Render panorámico multi-cancha y movimiento de cámara: B79.
- Iluminación basada en hora real de Cajamarca: B80.
- Rediseño de las landings deportivas legacy: B81.
- Cambios de backend, reservas, precios, disponibilidad o Supabase.
