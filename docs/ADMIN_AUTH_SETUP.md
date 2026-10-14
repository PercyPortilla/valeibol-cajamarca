# Valeibol · Fase 6 — Configuración de Supabase Auth

Esta fase usa **Supabase Auth real** para `/admin`. No existe autenticación demo: si faltan credenciales, el formulario queda deshabilitado y el panel protegido redirige al login.

## 1. Variables de entorno

Copia `.env.example` a `.env.local` y completa únicamente las claves públicas permitidas para la aplicación:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_ANON_O_PUBLISHABLE_KEY
```

No pongas `SUPABASE_SERVICE_ROLE_KEY` en `NEXT_PUBLIC_*`, en componentes React ni en Vercel como variable pública. La aplicación no necesita esa clave para funcionar; Fase 6 mantiene todas las operaciones administrativas sobre la sesión autenticada y RPCs específicas.

## 2. Aplicar migraciones y seed

Con Supabase CLI instalado:

```bash
supabase start
supabase db reset
```

En un proyecto remoto, enlaza el proyecto y aplica las migraciones mediante el flujo oficial de Supabase que uses en tu equipo. Deben quedar aplicadas, en orden:

1. `202610140001_phase3_core.sql`
2. `202610140002_phase4_public_booking.sql`
3. `202610140003_phase5_admin_auth.sql`
4. `202610140004_phase6_admin_operations.sql`

El seed conserva:

- negocio Valeibol;
- cancha principal marcada como demo/provisional;
- horario provisional 08:00–23:00;
- S/35/h sin luz;
- S/60/h con luz.

El horario provisional **no es un dato confirmado del negocio**.

## 3. Crear el primer propietario de forma segura

### Opción recomendada para el primer usuario

1. Abre **Supabase Dashboard → Authentication → Users**.
2. Crea el usuario propietario con un correo real del dueño/administrador y una contraseña fuerte.
3. Confirma el correo según la configuración del proyecto.
4. Copia el UUID del usuario creado.
5. Abre **SQL Editor** y ejecuta, reemplazando `UUID_DEL_USUARIO` y el nombre visible:

```sql
insert into public.profiles (
  user_id,
  business_id,
  role,
  display_name,
  is_active
)
select
  'UUID_DEL_USUARIO'::uuid,
  b.id,
  'owner'::public.app_role,
  'Propietario Valeibol',
  true
from public.businesses b
where b.slug = 'valeibol-cajamarca';
```

Verifica:

```sql
select user_id, business_id, role, display_name, is_active
from public.profiles
where user_id = 'UUID_DEL_USUARIO'::uuid;
```

No crees el propietario mediante un formulario público.

## 4. Política de roles

- `owner`: acceso administrativo completo de Fase 6, incluida edición de reservas.
- `admin`: mismo alcance operativo de Fase 6 que `owner` para agenda y edición.
- `staff`: puede leer la agenda, confirmar/cancelar, crear reserva manual y bloquear/desbloquear; no puede editar una reserva existente.

Las tres funciones dependen de un perfil activo vinculado a `auth.uid()`. Un usuario de Supabase Auth sin perfil válido no entra al panel y termina en `/admin/acceso-denegado`.

## 5. Mínimo privilegio de Fases 5–6

Las migraciones de Fases 5–6:

- mantiene `anon` sin `SELECT` sobre `customers`, `reservations`, `profiles` y demás PII;
- permite lectura administrativa a `authenticated` únicamente bajo RLS;
- revoca `INSERT/UPDATE/DELETE` directos al rol `authenticated` en las tablas administrativas;
- conserva las RPCs de contexto/lectura de Fase 5;
- añade RPCs específicas de Fase 6 para pizarra, confirmar, cancelar, crear reserva manual, editar y bloquear/desbloquear;
- deriva negocio y permisos desde `auth.uid()/profiles`;
- mantiene revocado el CRUD genérico directo sobre reservas, clientes y bloqueos.

## 6. Probar manualmente el flujo completo

Arranca la app:

```bash
npm install
npm run dev
```

Después prueba:

1. Abre `/admin` en ventana privada sin sesión.
2. Debe redirigir a `/admin/login?reason=session&next=...`.
3. Introduce credenciales incorrectas: el login debe fallar sin revelar si el correo existe.
4. Introduce las credenciales correctas del propietario.
5. Debe entrar a `/admin` y mostrar negocio, rol y timezone reales del perfil.
6. Entra a `/admin/reservas`.
7. Si existen solicitudes de Fase 4, deben aparecer nombre y WhatsApp **solo dentro del panel**.
8. Abre `/admin/disponibilidad` y comprueba la pizarra operativa.
9. Abre simultáneamente la web pública y comprueba que PII/estados internos nunca aparezcan allí.
10. Pulsa `Cerrar sesión`.
11. Intenta volver a `/admin`: debe redirigir nuevamente al login.
12. Desactiva el perfil (`is_active=false`) y repite login: la sesión puede existir, pero el acceso debe terminar en `/admin/acceso-denegado`.

## 7. Validaciones automatizadas

```bash
npm run qa
npm run lint
npm run typecheck
npm run build
```

Con Supabase local:

```bash
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

Para el test integrado de Auth/RLS se requiere una service-role **solo en la terminal de pruebas**, nunca en frontend:

```bash
export NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='...'
export SUPABASE_SERVICE_ROLE_KEY='...'
npm run integration:phase5
npm run integration:phase6
```

`integration:phase5` comprueba Auth/RLS. `integration:phase6` añade carreras reales de concurrencia para reserva manual contra reserva manual y reserva contra bloqueo. Ambos usan service-role únicamente para preparación/limpieza del test en terminal segura.
