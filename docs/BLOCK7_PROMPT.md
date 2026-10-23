# Prompt operativo · Bloque 7 — Usuarios y clientes

Continúa sobre el proyecto existente y considera los Bloques 1–6 cerrados. Implementa únicamente el BLOQUE 7, Usuarios y clientes, añadiendo identidad autenticada e historial personal sin romper la reserva guest existente ni crear un segundo sistema de autenticación.

## Objetivo

Consolidar `/mi-cuenta` como espacio privado del cliente usando Supabase Auth por correo y contraseña. Un usuario puede registrarse, confirmar su correo cuando corresponda, iniciar/cerrar sesión y consultar únicamente las reservas vinculadas a su propia identidad. Las reservas sin cuenta continúan siendo válidas.

## Seguridad e identidad

- El navegador nunca envía ni controla `userId` o `authenticatedUserId` en el payload público de reserva.
- El API de Next obtiene la identidad con la sesión Supabase server-side (`auth.getUser()` o mecanismo equivalente validado por Supabase) y solo entonces la adjunta al salto server-to-server hacia la Edge Function.
- La Edge Function acepta esa identidad únicamente después de validar el secreto server-to-server existente.
- `link_public_reservation_user(reservation_id,user_id)` permanece revocada para `public`, `anon` y `authenticated`; solo `service_role` puede ejecutarla.
- `get_my_reservations()` no acepta parámetros de identidad y filtra exclusivamente por `auth.uid()`.
- El historial del cliente no expone teléfono, nombre administrativo del cliente, notas internas ni otra PII del panel.
- `reservations.user_id` permanece nullable para conservar el flujo guest.
- La cuenta cliente no concede permisos `owner`, `admin` ni `staff`; el trigger global crea cuentas nuevas con rol `customer`.
- `/mi-cuenta` debe renderizarse dinámicamente y participar del refresco de cookies/session SSR; una visita anónima sigue permitida para mostrar login/registro.
- El callback de correo solo permite destinos internos autorizados como `/mi-cuenta`; mantener protección contra open redirects.

## UX de Mi cuenta

- Mantener una interfaz de cliente separada del login administrativo aunque ambos compartan Supabase Auth.
- Usuario anónimo: mostrar selector claro Iniciar sesión / Crear cuenta, correo, contraseña y feedback de carga/error/éxito.
- Registro: contraseña mínima de 8 caracteres y mensaje claro si debe confirmar correo.
- Usuario autenticado: mostrar correo, acción para buscar otra cancha, logout e historial privado.
- Si falla la RPC de historial, mostrar un estado de error explícito; nunca presentarlo como historial vacío.
- Si una reserva autenticada se crea pero falla el vínculo con la cuenta, mantener la reserva creada y avisar claramente que no aparecerá en el historial; no inducir al usuario a duplicar el horario.
- Si el historial está vacío, explicar que solo las nuevas reservas hechas con la sesión activa se vinculan y ofrecer volver a `/buscar`.
- Traducir estados a `Pendiente`, `Confirmada`, `Completada` y `Cancelada`; acompañarlos con una explicación breve.
- Mostrar fecha, horario, modalidad y valor de reserva sin presentar ese valor como cobro recibido.
- No mostrar ni reintroducir reportes, métodos o estados de pago. Cualquier coordinación económica permanece fuera de la plataforma y puede realizarse por WhatsApp.
- Mantener “Mi cuenta” en la navegación global.

## Diseño

- Aplicar el sistema visual existente; no crear un design system paralelo.
- Para esta pantalla tipo app, priorizar jerarquía compacta, superficies planas, bordes sutiles, tipografía legible y una acción principal clara.
- Evitar hero sobredimensionado, sombras decorativas, cards innecesarias y textos menores a tamaños razonables para lectura.
- Controles táctiles principales de al menos 44 px, foco visible, estados accesibles y responsive usable en móvil estrecho.

## Límites

- No instalar dependencias nuevas.
- No actualizar Next.js en este bloque.
- No hacer deploy, push, merge ni PR.
- No modificar pagos ni reabrir Bloques 5–6 salvo una regresión demostrada por este trabajo.

## Validación obligatoria

Ejecutar `git diff --check`, `npm run typecheck`, `npm run lint`, tests enfocados del Bloque 7, `npm test`, `npm run validate:supabase-security`, `npm run qa`, `npm run validate:repo` y `npm run build`. Si Supabase CLI/Postgres local no está disponible, registrar ese bloqueo con precisión y no afirmar que SQL local fue ejecutado. Corregir cualquier regresión causada por el bloque antes de cerrarlo.
