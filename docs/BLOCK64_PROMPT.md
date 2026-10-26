# BLOQUE 64 — Logo oficial + QA visual de la home premium

Continúa sobre B63. Integra en la página madre el logo metálico entregado por el usuario sin trasladar esa identidad a los tenants.

## Objetivo

- Usar el logo oficial de Caxas SportCenter en el header premium de la home.
- Mantener visible el subtexto `Plataforma deportiva · Cajamarca`.
- Conservar el header genérico anterior en superficies no premium.
- Optimizar el asset para web y mantenerlo por debajo de 100 KB.
- Verificar visualmente desktop, tablet y móvil, incluyendo 17:00/18:00 y cambio de deporte.
- Corregir únicamente defectos visuales encontrados en B63/B64.

## Restricciones

- No tocar backend, reservas, auth, datos ni permisos.
- No reemplazar logos propios de tenants.
- No convertir la interfaz completa en una textura metálica.
- Mantener accesibilidad, targets táctiles y reduced motion.

## Validación

- QA automatizada de layout/overflow/accesibilidad cuando el entorno local disponga de navegador compatible.
- Tests focales, TypeScript, lint, validate:repo, suite completa, build y diff-check.

No hacer commit, push ni deploy sin autorización explícita.

