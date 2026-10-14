# Fase 6 — Operación administrativa y pizarra digital

## 1. Objetivo

Fase 6 convierte el panel autenticado de Fase 5 en una herramienta operativa sin abrir CRUD genérico. Toda mutación pasa por una RPC PostgreSQL específica, `SECURITY DEFINER`, que vuelve a validar identidad, negocio, rol, cancha, horario, estado, tarifa y conflictos.

La web pública no cambia de política: únicamente recibe `Disponible`, `Ocupado` o `No disponible` mediante la RPC sanitizada de disponibilidad.

Para que una pestaña pública ya abierta reaccione a cambios administrativos sin exponer reservas, Fase 6 añade `availability_revisions`: una señal Realtime que contiene únicamente `business_id`, contador de revisión y `updated_at`. Al recibirla, el navegador vuelve a consultar la RPC pública sanitizada. Si Realtime no está disponible, permanecen el refresco por foco/visibilidad y polling de 30 s como fallback.

## 2. Política de estados

### Reservas

- `pending`: solicitud pública pendiente de aprobación; **sí bloquea** agenda.
- `confirmed`: aprobada por personal autorizado; sigue bloqueando el mismo ledger, sin insertar otra ocupación.
- `cancelled`: libera agenda.
- `completed`: histórico completado; el modelo existente lo considera bloqueante, aunque normalmente corresponde a intervalos pasados.

Transiciones implementadas:

```text
pending   -> confirmed
pending   -> cancelled
confirmed -> cancelled
confirmed -> confirmed   (idempotente)
cancelled -> cancelled   (idempotente)
```

No se permite cancelar `completed` ni editar `cancelled/completed`.

### Bloqueos

- `active`: bloquea agenda.
- `cancelled`: desbloqueado/liberado.

## 3. Matriz de permisos

| Acción | owner | admin | staff |
|---|:---:|:---:|:---:|
| Ver agenda privada | ✓ | ✓ | ✓ |
| Confirmar solicitud | ✓ | ✓ | ✓ |
| Cancelar reserva | ✓ | ✓ | ✓ |
| Reserva manual | ✓ | ✓ | ✓ |
| Crear bloqueo | ✓ | ✓ | ✓ |
| Desbloquear | ✓ | ✓ | ✓ |
| Editar reserva existente | ✓ | ✓ | — |

La UI oculta acciones no permitidas, pero PostgreSQL vuelve a imponer la regla. `staff` que invoque directamente `admin_edit_reservation` recibe `insufficient_role` (`42501`).

## 4. RPCs nuevas

- `get_admin_schedule(date,date)` — pizarra privada por negocio derivado de `auth.uid()`.
- `admin_confirm_reservation(uuid)`.
- `admin_cancel_reservation(uuid)`.
- `admin_create_manual_reservation(...)`.
- `admin_edit_reservation(...)`.
- `admin_create_schedule_block(...)`.
- `admin_cancel_schedule_block(uuid)`.

Las mutaciones **no aceptan** `business_id`, `hourly_rate`, `total_amount` ni un `status` arbitrario aportado por el navegador.

## 5. Doble reserva y concurrencia

La fuente de verdad continúa siendo:

```text
reservations / schedule_blocks
          ↓ triggers
court_schedule_entries
          ↓
EXCLUDE USING gist (
  court_id WITH =,
  tstzrange(start_at,end_at,'[)') WITH &&
)
WHERE blocks_availability
```

Por tanto:

- `18:00–20:00` vs `19:00–20:00` → conflicto.
- `18:00–20:00` vs `18:00–20:00` → conflicto.
- `18:00–20:00` vs `20:00–21:00` → permitido.
- reserva manual vs bloqueo simultáneo → como máximo uno puede ocupar.

Confirmar un `pending` no inserta una segunda fila en el ledger: el trigger actualiza la misma entrada por `(source_kind, source_id)`.

## 6. Tarifa autoritativa

El formulario del panel puede mostrar una estimación desde configuración central:

- sin luz: S/35/h;
- con luz: S/60/h.

Pero PostgreSQL vuelve a consultar `pricing_rules` y recalcula el total. La RPC de reserva manual/edición no acepta precio o total del cliente.

## 7. Horario provisional

El seed continúa usando **08:00–23:00** lunes-domingo únicamente como configuración provisional de demostración. La pizarra muestra la advertencia `Horario provisional` hasta que el propietario confirme el horario real.

No se debe presentar ese horario como dato oficial del negocio.

## 8. Flujo manual de prueba solicitado

### A. Login

1. Configura Supabase y crea un perfil `owner` siguiendo `ADMIN_AUTH_SETUP.md`.
2. Abre `/admin` sin sesión: debe redirigir a `/admin/login`.
3. Inicia sesión con correo/contraseña.
4. Debe abrir el panel y mostrar el rol real.

### B. Pizarra

1. Abre `/admin/disponibilidad`.
2. Comprueba los 7 días en escritorio.
3. En móvil 360/390/430 px, comprueba el selector horizontal de días.
4. Cambia Semana anterior / HOY / Semana siguiente.
5. Verifica que no aparezcan métricas ficticias.

### C. Pending -> Confirmed

1. Genera una solicitud real desde la web pública en un horario disponible.
2. Vuelve al panel y localiza el bloque `Pendiente`.
3. Debe verse nombre + WhatsApp únicamente dentro del panel.
4. Pulsa **Confirmar**.
5. El estado debe pasar a `Confirmada`.
6. No debe crearse un segundo bloque de ocupación.
7. En la web pública el horario debe seguir `Ocupado`, sin PII.

### D. Cancelación -> liberación

1. Pulsa **Cancelar** sobre una `pending` o `confirmed`.
2. Acepta la confirmación destructiva.
3. La reserva debe pasar a `cancelled`.
4. `court_schedule_entries.blocks_availability` debe quedar `false` para esa reserva.
5. La web pública debe volver a calcular el bloque como `Disponible` si no existe otra ocupación.

### E. Reserva manual

1. Pulsa **+ Reserva manual**.
2. Selecciona cancha, fecha, inicio/fin, cliente, WhatsApp y modalidad.
3. Comprueba la estimación S/35 o S/60 por hora.
4. Guarda.
5. La reserva debe crearse `confirmed`.
6. Comprueba en DB que `hourly_rate/total_amount` provienen de reglas del servidor.
7. El bloque debe aparecer `Ocupado` en la web pública.

### F. Bloquear / desbloquear

1. Pulsa **Bloquear horario** o el acceso rápido de un slot disponible.
2. Elige motivo (mantenimiento, academia, torneo, evento, cierre u otro).
3. Guarda.
4. El panel debe mostrar `Bloqueada`.
5. La web pública debe mostrar `No disponible` y nunca el motivo interno.
6. Pulsa **Desbloquear**, confirma, y verifica que la agenda vuelva a calcular disponibilidad.

### G. Logout

1. Pulsa **Cerrar sesión**.
2. Visita `/admin/disponibilidad`.
3. Debe redirigir nuevamente al login.
4. Ninguna RPC administrativa debe ser ejecutable con `anon`.

## 9. Validación reproducible

```bash
npm install
npm run qa
npm run lint
npm run typecheck
npm run build
```

Supabase:

```bash
supabase start
supabase db reset
export LOCAL_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run supabase:test
```

Concurrencia real:

```bash
export NEXT_PUBLIC_SUPABASE_URL='...'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='...'
export SUPABASE_SERVICE_ROLE_KEY='...'
npm run integration:phase6
```

`SUPABASE_SERVICE_ROLE_KEY` en este último comando es exclusivamente para crear/limpiar el usuario temporal del test desde terminal segura. No forma parte de la aplicación ni se expone al navegador.
