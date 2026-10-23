# Prompt operativo · Bloque 12 — QA final y preparación de publicación

Trabaja sobre la plataforma global construida en los Bloques 1–11. No reabras bloques anteriores salvo que una validación final demuestre una regresión real.

## Objetivo

Cerrar la versión con QA integral, preservar compatibilidad con Valeibol y dejar preparado únicamente el artefacto validado. La publicación requiere autorización explícita separada.

## QA obligatorio

- Ejecutar `npm run typecheck`.
- Ejecutar `npm run lint`.
- Ejecutar `npm test`.
- Ejecutar `npm run validate:repo`.
- Ejecutar `npm run validate:supabase-security`.
- Ejecutar `npm run qa` cuando el entorno disponible lo permita.
- Ejecutar `npm run build`; si Next.js muestra únicamente el recordatorio de seguridad ya conocido, reintentar sin mezclar la actualización de dependencias en este bloque.
- Ejecutar `git diff --check`.
- Levantar el build local y comprobar por HTTP las rutas públicas principales.
- Verificar que la landing histórica de Valeibol siga disponible en `/complejo/valeibol-cajamarca`.
- Verificar que `/` sea la portada global y que `/buscar`, `/voley`, `/futbol`, `/reservar` y `/mi-cuenta` carguen sin error 5xx.
- Verificar que rutas protegidas administrativas mantengan sus controles de acceso.

## Supabase

- No aplicar migraciones directamente a producción desde este bloque si no existe una ruta de migración aprobada y verificable.
- Validar migraciones localmente con Supabase CLI/Postgres cuando Docker esté disponible.
- Si el entorno local de Supabase no está levantado, registrar el bloqueo ambiental con precisión; no ocultarlo ni sustituirlo por una falsa validación.
- Mantener RLS, grants, RPC sanitizadas y separación entre ADMIN global y admin de negocio.

## Preparación de publicación

- Confirmar que el repositorio remoto corresponde a `PercyPortilla/valeibol-cajamarca` y que la rama de producción es `main`.
- No publicar archivos temporales, secretos ni `.env`.
- En esta ejecución no crear commit, no hacer push y no desplegar mientras el usuario no lo autorice explícitamente.
- Cuando exista autorización posterior, crear un commit único y descriptivo, empujar únicamente la rama validada y reutilizar la integración Git/Vercel existente.
- No crear un proyecto Vercel duplicado.

## Validación posterior a una publicación autorizada

- Confirmar el SHA publicado.
- Comprobar el estado de Git local después del commit/push.
- Si se dispone del deployment, verificar `/`, `/buscar` y `/complejo/valeibol-cajamarca` y revisar errores de runtime.

## No mezclar

- No ejecutar la actualización de seguridad de Next.js en este bloque.
- No añadir funcionalidades nuevas.
- No rediseñar UI.
- No reintroducir pagos; no cambiar reservas, auth o esquema fuera de correcciones de regresión demostradas por QA.

## Entrega

Reportar:

1. estado de Bloques 2–12;
2. validaciones ejecutadas y resultados;
3. bloqueo de Supabase local, si persiste;
4. estado de Git y remoto;
5. commit/SHA, push y Vercel solo si una publicación fue autorizada y realmente ejecutada;
6. advertencia independiente de actualización de seguridad de Next.js.
