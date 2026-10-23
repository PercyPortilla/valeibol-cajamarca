# Prompt operativo · Bloque 8 — WhatsApp y comunicación de reservas

Continúa sobre el proyecto existente y considera los Bloques 1–7 cerrados. Implementa únicamente el BLOQUE 8, WhatsApp y comunicación de reservas, reutilizando la infraestructura oficial de WhatsApp Business/Cloud API ya existente. Este bloque reemplaza definitivamente el antiguo alcance de pagos: la plataforma no procesa cobros ni mantiene estados financieros.

## Objetivo

- Encolar un aviso transaccional al negocio cuando ingresa una nueva solicitud pública `pending`.
- Encolar un aviso al cliente cuando su reserva pasa a `confirmed`.
- Encolar un aviso al cliente cuando su reserva pasa a `cancelled`.
- Encolar un recordatorio de una reserva `confirmed` aproximadamente 24 horas antes.
- Facilitar desde el panel administrativo un acceso directo al chat de WhatsApp del cliente usando exclusivamente el teléfono ya autorizado para la operación.
- Mantener la coordinación adicional de la reserva por WhatsApp sin crear chat interno, pasarela de pagos ni automatización de marketing.

## Arquitectura y seguridad

- Usar únicamente la API oficial de WhatsApp Business/Cloud API.
- Tokens, phone number ID, versión de Graph API, nombres de templates y secretos viven solo server-side y nunca usan prefijo `NEXT_PUBLIC_`.
- `whatsapp_outbox` contiene PII operativa y permanece sin acceso para `public`, `anon` y `authenticated`.
- Reclamo, recordatorios y finalización del outbox se ejecutan únicamente con `service_role` desde servidor.
- El processor exige `Authorization: Bearer ...` validado en tiempo constante. Acepta `WHATSAPP_PROCESSOR_SECRET` para ejecución manual/worker y `CRON_SECRET` para schedulers compatibles.
- El navegador nunca elige destinatario, template, estado de entrega ni variables autoritativas.
- Antes de llamar al proveedor, validar en runtime que `kind` y `template_key` pertenezcan a la allowlist transaccional y coincidan.
- La respuesta del processor solo devuelve conteos; nunca teléfonos, nombres ni variables del mensaje.
- Un fallo de WhatsApp nunca crea, confirma, cancela ni elimina una reserva.
- Si no puede persistirse el resultado de entrega, el processor debe devolver error 5xx para que infraestructura/monitorización pueda detectarlo.

## Consistencia del outbox

- Mantener un único mensaje por `(reservation_id, kind)`.
- Reclamar concurrentemente con `FOR UPDATE SKIP LOCKED`.
- Recuperar leases `processing` abandonados solo dentro del máximo de intentos.
- Un lease abandonado después del quinto intento debe terminar `failed` y desbloqueado; nunca quedar `processing` indefinidamente.
- Antes de reclamar, descartar (`skipped`) mensajes cuyo estado ya contradiga la reserva: aviso al owner solo mientras siga `pending`, confirmación solo mientras siga `confirmed`, cancelación solo mientras siga `cancelled`, recordatorio solo mientras siga `confirmed` y aún no haya iniciado.
- Si una reserva cambia de cancha, fecha/hora o cliente antes de enviar sus mensajes, refrescar destinatario/variables pendientes con datos autoritativos.
- Si una reserva confirmada se reprograma después de haber encolado un recordatorio, recalcular `available_at` aproximadamente 24 horas antes de la nueva hora; no enviarlo anticipadamente con la programación anterior.
- Si deja de estar confirmada, descartar recordatorios aún no enviados.
- Si un mensaje queda `processing`, el lease vence y la reserva ya contradice el tipo de mensaje, marcarlo `skipped` en vez de dejarlo bloqueado. Si la reserva asociada ya no existe, descartar la fila huérfana antes de cualquier envío.
- No afirmar semántica exactly-once ante Meta. La entrega externa es at-least-once mientras no exista reconciliación/webhook que permita demostrar lo contrario.

## UX y consentimiento

- En el éxito de una solicitud mostrar estado Pendiente, cancha, fecha, horario, modalidad/tarifa, valor de reserva y referencia.
- No llamar al valor “pago”, “cobro” o “dinero recibido”.
- El seguimiento por WhatsApp debe explicar que el negocio puede usar el número ingresado para coordinar la reserva, sin prometer que una notificación automática ya está activa en producción.
- En `/admin/reservas`, convertir el WhatsApp válido del cliente en una acción `Abrir chat` con `wa.me`; no exponer secretos ni añadir el teléfono a superficies públicas.
- No solicitar consentimiento de marketing dentro de la reserva mientras no exista un flujo explícito y reversible de alta/revocación. El payload público mantiene `marketingOptIn: false` únicamente por compatibilidad con la RPC existente.
- No presentar preferencias históricas de marketing como una campaña o funcionalidad activa.
- No mostrar `/admin/pagos`, métodos de pago, reportes financieros ni estados de cobro.

## Scheduler

- El processor soporta POST manual y GET para cron seguro.
- No activar un cron de producción sin confirmar la infraestructura y la frecuencia admitida por el plan del proyecto.
- Para que el recordatorio 23–25 h sea operativo, el scheduler final debe invocar el processor con una frecuencia suficientemente corta, normalmente horaria.
- Si se usa Vercel Cron, proteger con `CRON_SECRET`; si se usa Supabase Cron/pg_cron, mantener URL/token en Vault y fuera del navegador.
- Hasta verificar scheduler, templates aprobados y secretos en producción, describir el sistema como “preparado/configurable”, no como “avisos automáticos activos”.

## Límites

- No integrar pagos, Yape, Plin, transferencias ni pasarelas.
- No crear campañas masivas ni reenganche promocional.
- No instalar dependencias nuevas del proyecto.
- No actualizar Next.js en este bloque.
- No hacer deploy, push, merge ni PR.

## Validación obligatoria

Ejecutar `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run validate:phase8`, tests enfocados de WhatsApp, `npm test`, `npm run validate:supabase-security`, `npm run qa`, `npm run validate:repo` y `npm run build`. Ejecutar `supabase/tests/phase8.sql` únicamente si existe una base local/preview disponible; si no hay `LOCAL_DB_URL`, registrar la limitación y no afirmar que el SQL de integración se ejecutó.
