# Prompt operativo · Bloque 6 — Panel del propietario

Continúa sobre el proyecto existente y considera los Bloques 1–5 cerrados. Implementa únicamente el BLOQUE 6, Panel del propietario, reutilizando el panel administrativo actual como fuente operativa única. No crear un dashboard paralelo, repositorios duplicados ni una segunda capa de permisos.

## Objetivo

Consolidar `/propietario` como portada protegida del negocio para `owner` y `admin`, manteniendo a `staff` dentro de `/admin` con sus permisos limitados. El portal debe servir como acceso ordenado a las herramientas ya existentes: agenda/disponibilidad, reservas, clientes, precios, actividad/reportes y configuración.

## Reglas de acceso

- Resolver la sesión mediante el mismo `AdminContext` existente.
- `owner` y `admin` pueden entrar a `/propietario`.
- `staff` debe redirigir a `/admin` y no recibir enlace al portal propietario.
- Desde el shell administrativo, mostrar “Panel propietario” únicamente a roles autorizados.
- No afirmar soporte multi-negocio administrativo hasta que las RPC administrativas dispongan de contexto multi-negocio real.

## Decisión de producto: sin módulo de pagos

- La plataforma no procesa, reporta, verifica ni administra pagos.
- No mostrar “Pagos” en el portal propietario ni en la navegación administrativa.
- La ruta heredada `/admin/pagos` debe quedar neutralizada y redirigir a `/admin/reservas` para no exponer una función descartada.
- La reserva pública y `/mi-cuenta` no deben mostrar métodos de pago, reportes de pago ni estados financieros.
- Cualquier adelanto, Yape, Plin, transferencia u otra coordinación económica se acuerda directamente entre negocio y cliente por WhatsApp, fuera de la plataforma.
- No realizar una migración destructiva para borrar tablas/RPC históricas de pagos en este bloque; pueden conservarse temporalmente como compatibilidad de datos siempre que no estén expuestas en la UX.

## Integración

- Reutilizar `/admin/disponibilidad`, `/admin/reservas`, `/admin/clientes`, `/admin/precios`, `/admin/reportes` y `/admin/configuracion`.
- Mantener `/admin` como motor operativo único.
- No duplicar acciones server-side, RLS, repositorios o componentes administrativos.
- Mantener los importes de reservas como valor operativo, nunca como dinero cobrado.
- En superficies donde se mencione coordinación económica, aclarar que se realiza por WhatsApp y que la plataforma no acredita cobros.

## Límites

- No hacer deploy.
- No actualizar Next.js en este bloque.
- No reabrir el BLOQUE 5 salvo una regresión real causada por estos cambios.
- No instalar dependencias nuevas.

## Validación obligatoria

Ejecutar `git diff --check`, `npm run typecheck`, `npm run lint`, tests enfocados de portal/pagos desactivados, `npm test` y `npm run build`. Si aparece un error provocado por este bloque, corregirlo antes de cerrar.
