# BLOCK80 · Iluminación automática por hora real de Cajamarca

## Objetivo

Hacer que la iluminación visual del complejo deportivo siga la hora real de Cajamarca y no el horario elegido en el formulario de búsqueda.

## Alcance implementado

- Zona horaria explícita `America/Lima` mediante `Intl.DateTimeFormat`.
- Reflectores visuales encendidos desde las 18:00 hasta las 05:59.
- La escena recalcula su estado cada 15 segundos y también al volver a la pestaña o enfocar la ventana.
- Las ocho torres encienden de manera escalonada con destello inicial, halo y cono de luz.
- Las ventanas del complejo reciben un encendido cálido nocturno.
- Las luces de ciudad cambian de intensidad entre día y noche.
- `prefers-reduced-motion` elimina las animaciones de encendido.
- El indicador `Con iluminación` del buscador continúa dependiendo exclusivamente de la hora seleccionada porque representa la condición comercial de esa reserva.

## Separación de responsabilidades

- `sceneNight`: hora real de Cajamarca, solo experiencia visual.
- `reservationNeedsLighting`: hora seleccionada, conserva semántica de búsqueda/reserva.

## Fuera de alcance

- Rediseño de landings deportivas legacy: B81.
- Precios, disponibilidad, reservas, Supabase o reglas comerciales.
