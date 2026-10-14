# Valeibol — Reporte técnico Fase 5

Fecha del checkpoint: 2026-10-14

## 1. Objetivo de la fase

Implementar autenticación administrativa real con Supabase Auth y proteger `/admin`, manteniendo intacto el flujo público de Fases 2–4. La Fase 5 debía permitir lectura segura de solicitudes existentes, pero **sin** adelantar confirmaciones, cancelaciones, edición, reservas manuales, bloqueos de agenda ni pizarra operativa de Fase 6.

## 2. Resultado

Fase 5 completada en código.

Quedó implementado:

- login real por correo/contraseña mediante Supabase Auth;
- sesión SSR basada en cookies con `@supabase/ssr`;
- restauración de sesión válida;
- protección previa de rutas mediante `proxy.ts`;
- segunda validación server-side dentro del layout protegido;
- roles `owner`, `admin`, `staff` derivados desde `profiles` y `auth.uid()`;
- manejo de usuario autenticado sin perfil autorizado;
- logout real;
- dashboard administrativo base responsive;
- navegación completa prevista;
- lectura privada de solicitudes existentes;
- estados `pending`, `confirmed`, `cancelled`, `completed`;
- PII mínima visible únicamente dentro del área autenticada;
- RLS/privilegios reforzados;
- revocación de DML directo en esta fase de solo lectura;
- documentación para crear el primer propietario;
- tests unitarios, QA estático, SQL e integración Auth/RLS preparados.

No se implementó ninguna acción operativa de Fase 6.

---

## 3. Decisiones técnicas importantes

### 3.1 `/admin` tiene dos barreras

La primera barrera es `proxy.ts`:

1. comprueba que Supabase esté configurado;
2. obtiene/renueva la sesión mediante cookies SSR;
3. valida `auth.getUser()`;
4. si no hay usuario válido, redirige a `/admin/login`.

La segunda barrera está en `app/admin/(protected)/layout.tsx`:

1. vuelve a validar el usuario en servidor;
2. llama a `get_current_admin_context()`;
3. exige perfil activo;
4. exige rol `owner`, `admin` o `staff`;
5. usuario autenticado sin perfil válido termina en `/admin/acceso-denegado`.

Así no se confía solo en ocultar enlaces ni en estado React del navegador.

### 3.2 Se usó `proxy.ts`

El proyecto usa `next: latest`. La protección de red se dejó con la convención moderna `proxy.ts` en lugar de añadir un nuevo `middleware.ts` legado.

### 3.3 La base de datos decide el negocio actual

`get_current_admin_context()` y `get_admin_reservation_requests()` no reciben un `business_id` elegido por el navegador.

El negocio se deriva desde:

```sql
profiles.user_id = auth.uid()
```

y únicamente acepta perfiles activos con rol administrativo reconocido.

Esto reduce la posibilidad de manipular manualmente un identificador de negocio desde el cliente.

### 3.4 Fase 5 es administrativa, pero solo de lectura

Aunque Fase 3 ya contenía políticas de escritura para futuras fases, la migración 003 revoca a `authenticated`:

- `INSERT`;
- `UPDATE`;
- `DELETE`.

Se conserva lectura bajo RLS.

Fase 6 deberá añadir RPCs de mutación específicas en vez de volver a habilitar CRUD completo indiscriminadamente.

### 3.5 La PII no pasa a la web pública

La nueva PII administrativa disponible es únicamente la necesaria para operar solicitudes:

- nombre del cliente;
- WhatsApp;
- identificadores internos necesarios;
- cancha;
- intervalo;
- modalidad;
- tarifa aplicada;
- total;
- estado.

La web pública sigue consumiendo las RPCs sanitizadas de Fases 3–4 y no obtiene nombre, teléfono, notas internas ni perfiles.

### 3.6 Sin autenticación demo

Si faltan:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

la web pública puede seguir usando el modo demo de Fase 4, pero `/admin` **no** crea una sesión simulada. El formulario queda deshabilitado e informa que Supabase/Auth no está configurado.

---

## 4. Migración nueva

Archivo:

`supabase/migrations/202610140003_phase5_admin_auth.sql`

Incluye:

- mínimo privilegio para `authenticated`;
- RPC `get_current_admin_context()`;
- RPC `get_admin_reservation_requests(integer)`;
- ejecución de ambas RPC únicamente para `authenticated`;
- reafirmación de bloqueo anónimo de `profiles`, `customers`, `reservations`, `schedule_blocks`;
- PII administrativa limitada al negocio del perfil activo.

No se rediseñaron tablas existentes ni se ejecutó una migración destructiva.

---

## 5. Estructura administrativa

Rutas implementadas:

```text
/admin
/admin/login
/admin/acceso-denegado
/admin/reservas
/admin/disponibilidad
/admin/clientes
/admin/precios
/admin/ingresos
/admin/whatsapp
/admin/reportes
/admin/configuracion
```

Funcionales en Fase 5:

- `/admin/login`;
- `/admin`;
- `/admin/reservas`;
- `/admin/acceso-denegado`.

Las demás rutas muestran explícitamente que pertenecen a fases futuras y no presentan datos ficticios como reales.

---

## 6. Lectura administrativa de reservas

`/admin/reservas` usa:

```text
Componente visual
      ↓
adminService
      ↓
AdminReservationRepository
      ↓
SupabaseAdminReservationRepository
      ↓
RPC get_admin_reservation_requests
      ↓
PostgreSQL/Auth/RLS
```

El componente visual no hace consultas SQL ni instancia Supabase directamente.

Campos mostrados:

- cancha;
- inicio/fin en `America/Lima`;
- estado;
- cliente;
- WhatsApp;
- con/sin luz;
- tarifa histórica de la reserva;
- total autoritativo;
- origen.

No existen botones funcionales para confirmar, cancelar, modificar o bloquear.

---

## 7. Responsive y accesibilidad

Se añadieron/ajustaron estilos para:

- 360 px;
- 390 px;
- 430 px;
- tablet;
- escritorio.

Comportamiento:

- sidebar completa en escritorio;
- navegación administrativa legible en tablet;
- barra horizontal desplazable en móvil;
- tarjetas de reservas en lugar de tabla rígida;
- foco visible;
- formularios con `label`;
- errores con `role="alert"`;
- avisos con `role="status"`;
- navegación mediante enlaces reales;
- `aria-current="page"` en la sección activa.

---

## 8. Archivos añadidos

```text
proxy.ts
eslint.config.mjs
PHASE5_REPORT.md

docs/ADMIN_AUTH_SETUP.md

components/admin/AdminLoginForm.tsx
components/admin/AdminLogoutButton.tsx
components/admin/AdminNavigation.tsx
components/admin/AdminShell.tsx

app/admin/(protected)/layout.tsx
app/admin/(protected)/loading.tsx
app/admin/(protected)/error.tsx
app/admin/(protected)/page.tsx
app/admin/(protected)/reservas/page.tsx
app/admin/(protected)/[module]/page.tsx
app/admin/acceso-denegado/page.tsx

lib/auth.ts
lib/auth/server.ts
lib/admin/reservations.ts
lib/data/adminService.ts
lib/data/repositories/adminReservationRepository.ts
lib/data/repositories/supabaseAdminReservationRepository.ts

supabase/migrations/202610140003_phase5_admin_auth.sql
supabase/tests/phase5.sql

tests/admin-auth.test.ts
scripts/validate-phase5.mjs
scripts/integration-phase5-auth.mjs
```

## 9. Archivos modificados

```text
.env.example
README.md
package.json
app/admin/login/page.tsx
app/globals.css
lib/data/supabase/database.types.ts
lib/data/supabase/server.ts
```

El antiguo `app/admin/page.tsx` visual de Fase 1 fue reemplazado por la ruta dentro de `(protected)` para que `/admin` no pueda renderizarse fuera de la barrera de autorización.

---

## 10. Tests ejecutados

### QA estático

Comando:

```bash
npm run qa
```

Resultado de `validate-phase5.mjs`:

```text
26 / 26 PASS
```

Comprueba, entre otros:

- Proxy protege `/admin`;
- Supabase Auth real;
- no existe login mock;
- logout presente;
- layout protegido;
- roles correctos;
- negocio derivado de `auth.uid()`;
- RPC privada no ejecutable por anon;
- DML directo revocado;
- PII anónima bloqueada;
- componentes desacoplados de acceso a datos;
- reserva admin en solo lectura;
- regresión pública Fase 4;
- S/35 y S/60 intactos;
- `America/Lima` intacto;
- horario fallback provisional intacto;
- no existe service-role pública;
- breakpoints 360/390/430/tablet.

### Tests unitarios

Comando:

```bash
npm test
```

Resultado:

```text
26 tests
26 PASS
0 FAIL
```

Los 8 tests añadidos en Fase 5 cubren:

- Supabase no configurado;
- visitante anónimo/sesión ausente;
- usuario sin rol válido;
- roles owner/admin/staff;
- prevención de open redirect en `next`;
- estados de reservas;
- formateo en `America/Lima`;
- etiquetas con/sin luz.

Los 18 tests anteriores de disponibilidad/reserva también siguen pasando.

### Sintaxis de scripts Node

Ejecutado:

```bash
node --check scripts/validate-phase5.mjs
node --check scripts/integration-phase5-auth.mjs
node --check eslint.config.mjs
```

Resultado:

```text
PASS
```

---

## 11. Tests preparados pero no ejecutables en este entorno

### 11.1 SQL / RLS real

Archivo:

`supabase/tests/phase5.sql`

Valida:

- `anon` no tiene `SELECT` de customers/reservations/profiles;
- authenticated conserva SELECT sujeto a RLS;
- Fase 5 no concede INSERT/UPDATE/DELETE directo;
- RPC admin no ejecutable por anon;
- RPC admin ejecutable por authenticated;
- disponibilidad pública no declara PII.

No se ejecutó porque el entorno actual no dispone de `psql` ni Supabase CLI.

### 11.2 Integración real Auth/RLS

Archivo:

`scripts/integration-phase5-auth.mjs`

El script está preparado para:

1. crear un usuario temporal con service-role desde terminal segura;
2. probar login inválido;
3. probar login válido;
4. asociar perfil `owner`;
5. crear una solicitud pública temporal;
6. verificar sesión;
7. verificar contexto administrativo;
8. leer la solicitud con PII como admin;
9. verificar que anon no puede leer customers;
10. verificar que la RPC pública no filtra esa PII;
11. cerrar sesión;
12. verificar bloqueo de RPC administrativa después del logout;
13. limpiar datos temporales.

No se ejecutó aquí por ausencia de dependencias npm instaladas y de una instancia Supabase local/remota configurada.

---

## 12. Validaciones externas intentadas y limitaciones reales

### `npm install`

Intentado:

```bash
npm install --no-audit --no-fund
```

Resultado:

```text
timeout del entorno antes de completar la descarga
```

No quedó `node_modules` ni `package-lock.json`.

### `npm run typecheck`

Se intentó ejecutar con el `tsc` global disponible. No constituye un typecheck válido del proyecto porque faltan todas las dependencias/tipos de React, Next, Supabase y Node.

Los errores principales fueron módulos ausentes como:

```text
next/navigation
next/server
react
@supabase/ssr
@types/node
```

Por ello **no se marca typecheck como aprobado**.

### `npm run lint`

Resultado:

```text
eslint: not found
```

No se marca aprobado.

### `npm run build`

Resultado:

```text
next: not found
```

No se marca aprobado.

### Supabase / PostgreSQL

```text
supabase: command not found
psql: command not found
```

Migraciones, RLS y test integrado no fueron ejecutados contra PostgreSQL real en este entorno.

---

## 13. Cómo reproducir toda la validación

En un equipo con Internet y Node/npm:

```bash
npm install
npm run qa
npm run lint
npm run typecheck
npm run build
```

Luego, con Supabase CLI:

```bash
supabase start
supabase db reset
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

Para integración Auth:

```bash
export NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='ANON_LOCAL'
export SUPABASE_SERVICE_ROLE_KEY='SERVICE_ROLE_LOCAL'
npm run integration:phase5
```

La service-role se utiliza solamente en el script de integración/terminal segura y nunca se envía al navegador.

---

## 14. Prueba manual solicitada

### Visitante → `/admin`

1. Abre una ventana incógnita.
2. Visita `/admin`.
3. Debe redirigir a `/admin/login`.

### Login

4. Prueba credenciales incorrectas.
5. Debe permanecer en login con mensaje genérico.
6. Prueba usuario válido con perfil owner/admin/staff activo.
7. Debe entrar al dashboard.

### Sesión autorizada

8. Recarga `/admin`.
9. La sesión debe restaurarse sin pedir login de nuevo.
10. El dashboard debe mostrar el rol y negocio autorizados, no métricas ficticias.

### Lectura segura

11. Abre `/admin/reservas`.
12. Deben aparecer solicitudes existentes con cliente/WhatsApp solo dentro del panel.
13. Verifica los estados pending/confirmed/cancelled/completed cuando existan.
14. Verifica el total y tarifa histórica almacenados.
15. Abre la web pública en otra pestaña y confirma que no muestra nombres/teléfonos de otras reservas.

### Logout

16. Pulsa `Cerrar sesión`.
17. Debe regresar al login.
18. Intenta abrir `/admin/reservas` desde la barra de direcciones.
19. Debe volver a bloquearse y redirigir a login.

### Usuario sin perfil

20. Crea/autentica un usuario sin fila activa en `profiles`.
21. Al intentar entrar al panel debe terminar en `/admin/acceso-denegado`.

---

## 15. Riesgos pendientes

### Alto antes de producción

- Ejecutar realmente las 3 migraciones en Supabase/PostgreSQL.
- Ejecutar `phase5.sql`.
- Ejecutar `integration:phase5`.
- Ejecutar un `npm install` completo, `lint`, `typecheck` y `build`.
- Generar y versionar `package-lock.json` después de una instalación válida; actualmente `package.json` todavía usa versiones `latest` heredadas del checkpoint anterior.

### Funcionales pendientes por decisión de alcance

- confirmar/cancelar solicitudes;
- edición de reservas;
- creación manual;
- bloqueo/desbloqueo de horarios;
- pizarra semanal administrativa;
- administración de clientes;
- precios editables;
- ingresos;
- WhatsApp;
- reportes;
- automatizaciones.

No se adelantaron porque pertenecen a Fases 6+.

### Información del negocio pendiente

El horario 08:00–23:00 continúa marcado como **provisional** hasta confirmación del propietario.

---

## 16. Criterio de cierre

La Fase 5 queda detenida con:

```text
Fase 1  Arquitectura/diseño                ✓
Fase 2  Disponibilidad pública             ✓
Fase 3  Supabase/PostgreSQL/RLS            ✓
Fase 4  Solicitud pública pending          ✓
Fase 5  Auth + panel seguro de lectura     ✓ código / QA local
Fase 6  Operación administrativa           NO iniciada
```

No se avanzó a Fase 6.
