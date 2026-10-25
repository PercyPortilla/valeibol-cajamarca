# BLOQUE 26 — SQL E2E local reproducible para Supabase

## Objetivo

Cerrar la brecha de verificación que quedó después de B20–B25: las migraciones y los tests SQL existían y pasaban auditorías estáticas, pero no había un runner reproducible que levantara Postgres local, reconstruyera el esquema completo y ejecutara toda la suite SQL sin depender de `psql` instalado globalmente.

## Alcance implementado

- Supabase CLI fijada en `devDependencies` para que el proyecto use una versión reproducible.
- Runner SQL `scripts/run-supabase-sql-tests.mjs` que ejecuta cada archivo con `supabase db query --local --file`.
- Runner integral `scripts/run-supabase-local-e2e.mjs` que:
  1. exige Docker o runtime compatible;
  2. levanta exclusivamente Postgres local con `supabase db start`;
  3. ejecuta `supabase db reset --local` para aplicar todas las migraciones y seed del repositorio;
  4. ejecuta la suite SQL completa;
  5. detiene y elimina los volúmenes locales al finalizar.
- CI añade un job `supabase-sql-e2e` sobre `ubuntu-latest`, donde Docker está disponible, y ejecuta el mismo comando reproducible.
- `npm run supabase:test` ya no depende de `psql` ni de `LOCAL_DB_URL`.

## Seguridad / límites

- El runner usa únicamente `--local`.
- No usa `--linked`, `--project-ref` ni `--db-url` remoto.
- No requiere `SUPABASE_ACCESS_TOKEN` ni credenciales de producción.
- Si Docker no está disponible, falla explícitamente; nunca usa un proyecto remoto como fallback.
- Este bloque no despliega, no hace push, no aplica migraciones remotas y no altera datos de producción.

## Validación esperada

Con Docker disponible:

```bash
npm run supabase:e2e:local
```

El comando debe reconstruir la base local desde migraciones y terminar con:

```text
Supabase SQL E2E: PASS
```

En una máquina sin Docker, el resultado correcto es un error explícito indicando que el E2E local requiere Docker. Ese caso no equivale a un PASS de SQL E2E.
