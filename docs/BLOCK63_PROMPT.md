# BLOQUE 63 — Home premium negro + plata de Caxas SportCenter

Continúa sobre B1–B62 cerrados. Este bloque rediseña únicamente la página madre del marketplace y mantiene intacta la lógica de reservas, auth, tenants y backend.

## Objetivo

- Usar **Caxas SportCenter** como nombre oficial de la plataforma.
- Cambiar la home azul a una identidad negro carbón, grafito y plata, inspirada en el nuevo logo sin llenar la UI de texturas metálicas.
- Header premium con navegación Explorar, Deportes, Complejos y Mi cuenta.
- Hero con el mensaje “Encuentra dónde jugar en Cajamarca.” y cobertura fija “Cajamarca, Perú”.
- Quitar la ciudad editable del Hero.
- Mantener deporte dinámico desde el catálogo y añadir fecha/hora como parámetros de exploración.
- Crear una representación multicancha ligera con fútbol, vóley, básquet, futsal y coliseo.
- Destacar visualmente la cancha del deporte seleccionado mediante `sportTheme` centralizado.
- Derivar modo nocturno únicamente desde la hora elegida con `isNightSlot(selectedTime)`.
- Desde las 18:00 encender reflectores visuales y mostrar “Horario con iluminación”, sin inventar precios ni modificar reglas comerciales.
- Mantener estadísticas reales derivadas del catálogo.
- Conservar responsive, foco accesible y `prefers-reduced-motion`.

## Alcance técnico

- Sin tablas, RPCs ni migraciones nuevas.
- Sin cambios en reglas de reserva o pricing.
- El buscador general `/buscar` se conserva; la home usa un Hero cliente aislado para la interacción visual.
- El estilo premium queda principalmente bajo `.platform-home` y `.platform-header--premium`, evitando rediseñar las páginas tenant.

## Validación

- Tests focales de branding, Cajamarca fija, temas deportivos, noche desde las 18:00, multicancha, estadísticas y responsive.
- TypeScript, lint, validate:repo, Phase7, seguridad, suite completa, build y diff-check.

No hacer commit, push ni deploy sin autorización explícita.

