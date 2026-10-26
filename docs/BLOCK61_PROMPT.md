# BLOQUE 61 — Identidad global SportCenter Caxas + logos por complejo

Continúa sobre B1–B60 cerrados. La portada global debe representar a la plataforma, no a un negocio concreto.

## Objetivo

- Renombrar la marca madre a **SportCenter Caxas**.
- Eliminar accesos de deportes o negocios específicos del header global y reemplazarlos por navegación general: Buscar, Deportes, Complejos y Mi cuenta.
- Evitar que el hero promocione un complejo concreto; los negocios viven en la sección **Complejos disponibles**.
- Mostrar el logo real de cada negocio en su tarjeta, con fallback por inicial cuando no haya logo.
- Permitir que owner/admin de cada tenant configure su propio logo desde Configuración.
- Reparar el mojibake de nombres deportivos (`Vóley`, `Fútbol`, `Básquet`) en base de datos.

## Datos y seguridad

- Añadir `business_site_content.logo_url` como dato público sanitizado del tenant.
- Sembrar `/images/valeibol-logo.webp` para `valeibol-cajamarca`.
- `admin_update_site_content` deriva tenant desde `phase6_admin_actor()` y no acepta `business_id` del navegador.
- Solo owner/admin pueden modificar el logo.
- El catálogo público sigue limitado a negocios activos, confirmados y de Cajamarca.
- Las tablas continúan sin DML directo para `anon`/`authenticated`.

## UX

- Header global neutral y sin protagonismo de Valeibol.
- Hero genérico de SportCenter Caxas.
- Secciones con anchors `#deportes` y `#complejos`.
- Logo de negocio en la esquina superior de cada card; fallback limpio si falta.
- Editor de logo con URL o subida de archivo reutilizando `/api/admin/site-media`.

## Validación

- Tests de branding, navegación, logos, tenant scope y reparación de encoding.
- TypeScript, lint, validate:repo, seguridad, suite completa y build.

No hacer commit, push, deploy ni aplicar la migración remota sin autorización explícita.
