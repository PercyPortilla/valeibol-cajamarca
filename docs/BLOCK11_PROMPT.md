# Prompt operativo · Bloque 11 — UI/UX y responsive

Pulir la experiencia global sin rediseñar desde cero ni alterar lógica de reservas, auth, pagos o administración.

## Accesibilidad

- Añadir enlaces “Saltar al contenido principal” en la navegación global y en la landing heredada de Valeibol.
- Asegurar destinos de salto enfocables con `tabIndex=-1`.
- Añadir estados `:focus-visible` claros para links, botones, inputs, selects y controles interactivos.
- Mantener nombres accesibles explícitos en navegación.
- Respetar `prefers-reduced-motion: reduce` y eliminar transiciones no esenciales.

## Responsive

- Objetivos táctiles principales de al menos 44 px.
- Evitar overflow horizontal en navegación móvil, formularios, tarjetas y paneles.
- Mantener buscador, cards, panel propietario, cuenta, pagos y admin global utilizables en móvil.
- No cambiar el orden lógico de tabulación ni esconder acciones esenciales.

No instalar dependencias, no hacer deploy y no mezclar la actualización de seguridad de Next.js. Validar TypeScript, lint, tests y build.
