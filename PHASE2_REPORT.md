# Valeibol — Reporte de checkpoint Fase 2

## Objetivo completado

La web pública ahora prioriza disponibilidad y funciona con datos mock/provisionales claramente identificados, sin Supabase ni reservas persistentes.

## Archivos modificados

- `app/page.tsx`
  - Home pública reorganizada alrededor de disponibilidad.
  - Precios, servicios, galería, información, ubicación y contacto.
- `app/globals.css`
  - Calendario desktop/mobile, estados, responsive y secciones secundarias.
- `components/site/Header.tsx`
  - Navegación pública ampliada.
- `components/site/Footer.tsx`
  - Identificación de checkpoint Fase 2 y contacto.
- `components/site/CourtVisual.tsx`
  - Aclara que la ilustración no es una fotografía real.
- `config/business.ts`
  - Tarifas preservadas y configuración de horario provisional centralizada.
- `package.json`
  - Versión 0.2.0, script de tests y typecheck.
- `tsconfig.json`
  - Permite imports `.ts` necesarios por los tests Node de este checkpoint.
- `README.md`
  - Documentación de Fase 2 y QA manual.
- `preview/index.html`
  - Preview estático completo.

## Archivos nuevos

- `components/availability/AvailabilityCalendar.tsx`
- `lib/availability.ts`
- `tests/availability.test.ts`
- `preview/app.js`
- `scripts/validate-phase2.mjs`
- `PHASE2_REPORT.md`

## Decisiones técnicas

1. **Fechas reales, datos mock**
   - Las fechas y navegación corresponden a la semana real.
   - Los estados de los slots son determinísticos pero ficticios.
   - No se genera ni almacena información de clientes.

2. **Zona horaria del negocio**
   - Se centralizó `America/Lima` en `businessConfig`.
   - El botón HOY usa la fecha del negocio y no depende ciegamente de UTC.

3. **Horario de apertura provisional**
   - Se configuró temporalmente 08:00–23:00 todos los días para probar UI.
   - Está marcado como `mock-provisional` y la interfaz advierte que no es horario oficial.
   - Se cambia desde `config/business.ts` sin tocar componentes.

4. **Privacidad pública**
   - Los objetos de disponibilidad contienen únicamente id, fecha, inicio, fin y estado.
   - No existen nombres, teléfonos ni notas de clientes en el calendario público.

5. **Responsive**
   - >= 900 px: siete días simultáneos.
   - < 900 px: selector horizontal de siete días + lista vertical del día seleccionado.
   - Ajustes adicionales en 640, 430 y 360 px.

6. **CTA en Fase 2**
   - Solo aparece en slots `available`.
   - En este checkpoint lleva a contacto para no fingir una reserva persistente.
   - El flujo real corresponde a Fase 4.

7. **Galería honesta**
   - No se añadieron fotos genéricas como si fueran del negocio.
   - Se dejaron placeholders explícitos para fotos reales.

## Validaciones realizadas

### Tests unitarios

Comando:

```bash
npm test
```

Resultado:

- 8 tests ejecutados.
- 8 PASS.
- 0 FAIL.

Cubren:

- precios S/35 y S/60;
- marca de horario provisional;
- semana lunes-domingo;
- semana anterior/siguiente;
- cambio de mes/año;
- zona horaria America/Lima;
- ausencia de PII en slots mock;
- bloques provisionales de una hora.

### TypeScript de lógica pura

Comando ejecutado con TypeScript global:

```bash
tsc --noEmit --allowImportingTsExtensions --skipLibCheck --lib es2022,dom --moduleResolution bundler --module esnext --target es2022 lib/availability.ts config/business.ts
```

Resultado: PASS.

### Comprobación sintáctica TS/TSX del proyecto

Se ejecutó un typecheck de QA con declaraciones temporales para React/Next porque las dependencias npm no están instaladas en el entorno.

Resultado: PASS tras corregir la configuración de imports utilizada por los tests.

Los stubs temporales se eliminaron y **no forman parte del checkpoint**.

### Preview estático

- `node --check preview/app.js`: PASS.
- HTML parseado correctamente.
- IDs requeridos presentes.
- Llaves CSS equilibradas.
- Breakpoints 360, 430 y 899 detectados.
- Regla desktop de 7 columnas detectada.
- Comprobación de ausencia de nombres de clientes de ejemplo: PASS.
- Verificación de CTA condicionado a `available`: PASS.

### Build Next.js

No se pudo ejecutar `next build` en este entorno porque el checkpoint de Fase 1 no incluía `node_modules`/lockfile y el acceso al registry npm agotó el tiempo de espera en dos intentos de instalación.

Esto es una **limitación del entorno de validación**, no un build declarado como exitoso. Al probarlo en una máquina con acceso a npm, ejecutar:

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Fallos encontrados y corregidos durante QA

- Los tests Node no podían resolver el import interno de `config/business`; se corrigió usando import `.ts` explícito y `allowImportingTsExtensions`.
- Se añadió `type: module` para que el runner Node interprete correctamente los tests TS/ESM.
- Se evitó exponer datos inventados en galería/horarios como si fueran reales.

## Riesgos pendientes

1. **Horario operativo real no confirmado** — reemplazar el mock al recibirlo del propietario.
2. **Sin base de datos** — los estados actuales no son reservas reales; corresponde a Fase 3.
3. **Sin protección de concurrencia** — llegará con el modelo persistente/constraints de Fase 3.
4. **CTA no persiste reservas** — por diseño de alcance; corresponde a Fase 4.
5. **Build npm pendiente** — ejecutar al contar con acceso al registry.
6. **Dependencias con `latest` heredadas de Fase 1** — al instalar conviene generar lockfile y fijar versiones para reproducibilidad antes de producción.
7. **Fotos reales pendientes** — reemplazar placeholders cuando el propietario entregue material autorizado.

## Cómo probar manualmente

### Opción A — Preview sin instalar nada

Abrir:

`preview/index.html`

Probar:

1. Semana anterior.
2. Semana siguiente.
3. HOY.
4. En escritorio, confirmar siete columnas.
5. En móvil, cambiar los siete días desde el selector horizontal.
6. Confirmar que `Solicitar` solo aparezca en bloques verdes/Disponibles.
7. Confirmar que ocupados/no disponibles no muestren nombres.
8. Revisar S/35 sin luz y S/60 con luz.
9. Probar anchos 360, 390, 430, 768, 1024 y 1440 px.

### Opción B — Next.js

```bash
npm install
npm run dev
```

Luego abrir `http://localhost:3000`.

Estados especiales de QA:

- `/?demoState=loading`
- `/?demoState=empty`
- `/?demoState=error`

## Siguiente fase recomendada

Fase 3: Supabase + modelo de datos + RLS + disponibilidad persistente + protección real contra solapamientos.
