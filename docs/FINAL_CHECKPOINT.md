# Valeibol Cajamarca · checkpoint incremental

Fecha: 2026-10-14

Estado global: **NO PASS FINAL**.

La política actual es incremental: cada bloque funcional terminado y probado se mergea a `main`; los demás permanecen aislados.

## Main

SHA actual:

- `40788e90f769311140def63e9d65fd8be2345a73`

Integrado:

- Bloque 1: repositorio/CI base;
- Bloques 4–5: UX, responsive, accesibilidad y web comercial;
- Bloque 7: WhatsApp transaccional seguro en modo dormante.

## PR #4

`work/final-checkpoint -> main`

Debe contener únicamente trabajo pendiente de:

- Bloque 2 — Supabase real / seguridad;
- Bloque 3 — E2E/concurrencia real;
- Bloque 6 — producción/DevSecOps.

No debe volver a incluir Bloques 4–5 ni 7.

## Bloque 1

**PASS / EN MAIN**

CI reproducible con `npm ci`, lint, typecheck, tests, QA y build.

## Bloque 2

**BLOCKED EXTERNO / FUERA DE MAIN**

El conector Supabase devuelve `{"projects":[]}`. Sin proyecto real no se aplican migraciones ni se declaran Advisors/SQL como PASS.

## Bloque 3

**BLOCKED EXTERNO / FUERA DE MAIN**

La matriz E2E/concurrencia está preparada en PR #4 pero requiere Supabase/PostgreSQL real.

## Bloque 4

**PASS / MERGED**

Merge `a04d8aeed465763629492337d6fa57abc441ab5a`.

Chrome/Axe en 360/390/430/768/1024/1440: PASS.

## Bloque 5

**PASS / MERGED**

Incluye privacidad, favicon simple, seis espacios de galería y copy comercial sin inventar fotografías u horario oficial.

## Bloque 6

**PARCIAL / FUERA DE MAIN**

Pendientes críticos:

- variables reales de Supabase en Vercel;
- smoke backend real;
- política no-mock probada con backend real;
- branch protection/required checks;
- observabilidad/runtime logs cuando el scope lo permita;
- producción sigue en SHA antiguo por build-rate-limit.

## Bloque 7

**PASS DE CÓDIGO / MERGED**

Merge `40788e90f769311140def63e9d65fd8be2345a73`.

La integración está dormante hasta aplicar migración/configurar Meta. La validación real contra Meta era condicional a disponer de credenciales/templates autorizados, que no existen en la sesión.

## Regla para próximos merges

Merge a `main` únicamente cuando el bloque:

1. esté funcionalmente completo;
2. tenga pruebas aplicables en PASS;
3. no tenga FAIL crítico propio;
4. haya completado sus validaciones externas críticas cuando sean necesarias para ese bloque.

## Próximo cierre

El próximo merge posible será el primer bloque entre 2, 3 y 6 que cumpla esas cuatro condiciones. Hasta entonces, PR #4 permanece draft.
