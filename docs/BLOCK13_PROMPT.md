# Prompt operativo · Bloque 13 — Release controlado a producción

Trabaja sobre el estado validado de los Bloques 1–12. Este bloque no agrega funcionalidades: integra el release existente, lleva las migraciones pendientes a Supabase, publica el commit validado y verifica la producción real.

## Objetivo

Cerrar la brecha entre el working tree validado y producción sin crear sistemas paralelos, sin duplicar proyectos y sin mezclar rediseños o funcionalidades nuevas.

## Reglas de seguridad

- Reutilizar exclusivamente el repositorio GitHub existente PercyPortilla/valeibol-cajamarca.
- Reutilizar exclusivamente el proyecto Supabase existente valeibol-cajamarca.
- Reutilizar exclusivamente el proyecto Vercel ya vinculado al repositorio; no crear otro proyecto con nombre parecido.
- No imprimir, copiar ni versionar secretos, tokens, contraseñas, .env o credenciales.
- No asumir que una migración está aplicada: comparar primero el historial remoto con supabase/migrations.
- Aplicar migraciones en orden de timestamp y verificar su resultado antes de continuar.
- No afirmar que WhatsApp automático está operativo si faltan scheduler, plantillas Meta o secretos de producción.
- Ante una regresión causada por este release, corregirla y repetir la validación antes de publicar.

## Paso 1 · Preflight local

- Confirmar rama main y remoto origin.
- Confirmar que git diff --check no tiene errores.
- Ejecutar npm audit, typecheck, lint, tests, validate:repo, validate:supabase-security, qa y build.
- Confirmar Next.js 16.4.3 o superior sin reintroducir la versión vulnerable 16.4.0.
- Revisar que no existan secretos o archivos temporales destinados al commit.

## Paso 2 · Supabase producción

- Confirmar que el proyecto real sea valeibol-cajamarca.
- Revisar el historial remoto de migraciones.
- Aplicar solo las migraciones locales aún no registradas, en orden cronológico.
- Para este release, la secuencia esperada posterior a reservation_archiving es:
  1. 20261023085123_global_multitenant_schema.sql
  2. 20261023090448_multi_sport_booking_rules.sql
  3. 20261023091203_customer_accounts_history.sql
  4. 20261023091715_manual_payments.sql
  5. 20261023092310_platform_admin_dashboard.sql
  6. 20261023211749_block8_whatsapp_reliability.sql
  7. 20261023213107_block9_platform_admin_metrics.sql
- No saltar una migración intermedia aunque la UI actual no exponga su módulo; las posteriores pueden depender de tipos, tablas o RPC creadas previamente.
- Verificar tablas sports, venues, user_accounts, relaciones cancha/sede/deporte, historial cliente, RPC multi-deporte, RPC de ADMIN global, aislamiento RLS, grants y outbox WhatsApp.
- Ejecutar Security Advisor y Performance Advisor después del DDL.
- Distinguir hallazgos intencionales de blockers reales. No arreglar funciones públicas o tablas privadas únicamente para silenciar un advisor si eso rompe el modelo de acceso.

## Paso 3 · Git

- Crear un único commit de release con todos los cambios validados de Bloques 2–13 y el upgrade de seguridad de Next.js.
- Confirmar el SHA exacto.
- Hacer push únicamente a origin/main.
- Confirmar que origin/main apunte al mismo SHA.

## Paso 4 · Vercel

- Confirmar proyecto, equipo, repositorio y rama de producción antes de desplegar.
- Preferir el deploy disparado por la integración Git existente.
- Si se usa CLI/MCP, reutilizar el proyecto existente y verificar el target production.
- Esperar estado READY antes de QA.
- No crear un proyecto Vercel nuevo.

## Paso 5 · QA de producción

Verificar por HTTP y, cuando exista sesión autorizada, por flujo funcional:

- /
- /buscar
- /voley
- /futbol
- /complejo/valeibol-cajamarca
- /reservar
- /mi-cuenta
- /admin/login
- /admin
- /propietario
- /admin-global

Comprobar además portada global, catálogo multi-tenant, reserva multi-deporte, Valeibol como primer tenant, aislamiento CUSTOMER / OWNER / ADMIN, redirecciones protegidas, ausencia de 5xx, runtime logs y SHA publicado.

## WhatsApp

- La publicación del código no equivale a activar automatización.
- Confirmar por separado templates aprobados de Meta, token/configuración server-side y scheduler.
- Mientras eso no esté verificado, conservar copy que no prometa recordatorios automáticos.

## No mezclar

- No agregar nuevos deportes, mapas, reseñas, favoritos, SEO avanzado ni rediseño de marketplace.
- No modificar precios o reglas comerciales sin evidencia de regresión.
- No eliminar la infraestructura de pagos existente aunque actualmente esté fuera de la narrativa visible.
- No crear un nuevo proyecto Supabase, Vercel o GitHub.

## Entrega

Reportar:

1. migraciones remotas antes/después;
2. resultados de advisors y validaciones;
3. SHA del commit y estado de origin/main;
4. deployment Vercel y URL de producción;
5. QA de rutas;
6. estado real de WhatsApp;
7. riesgos residuales concretos.
