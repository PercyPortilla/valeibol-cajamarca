# Valeibol · WhatsApp Business Platform

La integración usa la API oficial de WhatsApp Business/Cloud API. No usa automatización de navegador ni librerías no oficiales.

## Variables server-side

Configurar únicamente en Vercel/Supabase server-side, nunca con prefijo `NEXT_PUBLIC_`. `WHATSAPP_API_VERSION` es obligatoria: usa una versión de Graph API que Meta mantenga soportada al momento de activar producción, en lugar de depender de un valor hardcodeado:

```env
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=<versión soportada actualmente por Meta>
WHATSAPP_TEMPLATE_LANGUAGE=es_PE
WHATSAPP_TEMPLATE_OWNER_NEW_REQUEST=
WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMED=
WHATSAPP_TEMPLATE_CUSTOMER_CANCELLED=
WHATSAPP_TEMPLATE_CUSTOMER_REMINDER=
WHATSAPP_PROCESSOR_SECRET=
```

## Eventos transaccionales

- `owner_new_request`: nueva solicitud pública pending al teléfono del negocio.
- `customer_confirmed`: confirmación al WhatsApp del cliente.
- `customer_cancelled`: cancelación al cliente.
- `customer_reminder`: recordatorio de una reserva confirmed aproximadamente 24 h antes.

La base solo crea filas privadas en `whatsapp_outbox`. PostgreSQL no realiza HTTP.

## Procesador

`POST /api/internal/whatsapp/process` para ejecución manual/worker y `GET /api/internal/whatsapp/process` para schedulers HTTP.

Requiere:

```http
Authorization: Bearer <WHATSAPP_PROCESSOR_SECRET>
```

Cuando el scheduler sea Vercel Cron, también se acepta `CRON_SECRET` como Bearer server-side. No reutilices ninguno de estos secretos en código cliente.

El worker:

1. encola recordatorios debidos de forma idempotente;
2. reclama mensajes con `FOR UPDATE SKIP LOCKED`;
3. llama Meta Cloud API con templates aprobados;
4. registra `sent` o `failed`;
5. aplica backoff a fallos;
6. nunca devuelve PII en la respuesta.

### Activación del scheduler

El repositorio deja el endpoint listo, pero **no activa un cron automáticamente** porque la frecuencia permitida depende del plan/infraestructura donde se despliegue. El recordatorio usa una ventana aproximada de 23–25 horas antes de la reserva, así que en producción el processor debe ejecutarse con una cadencia suficientemente frecuente (por ejemplo, horaria).

Con Vercel Cron, los jobs llaman rutas mediante `GET` y pueden autenticarse con `CRON_SECRET`. Si el plan admite frecuencia horaria, una configuración típica es:

```json
{
  "crons": [
    { "path": "/api/internal/whatsapp/process", "schedule": "0 * * * *" }
  ]
}
```

No añadas este `vercel.json` a producción hasta confirmar que el plan del proyecto admite esa frecuencia. Como alternativa, Supabase Cron/pg_cron puede invocar un endpoint HTTP de forma programada guardando el secreto en Vault. La activación del scheduler es una tarea de infraestructura y debe verificarse en producción antes de afirmar que los avisos automáticos están activos.

## Consentimiento

Los eventos anteriores son mensajes transaccionales de una reserva. El flujo público actual **no solicita consentimiento de marketing ni ejecuta campañas promocionales**. El campo histórico `marketing_opt_in` permanece en el esquema por compatibilidad, pero la nueva reserva envía `false` y no lo presenta como una preferencia editable hasta que exista un flujo explícito de alta/revocación.

## Reglas de seguridad

- `anon` y `authenticated` no pueden leer `whatsapp_outbox`.
- service-role se usa solo en servidor.
- Los templates y destinatarios se derivan de datos autoritativos de PostgreSQL.
- La UI no puede decidir destinatario, template ni estado de entrega.
- Los fallos de WhatsApp no revierten ni eliminan reservas.
- Antes de reclamar mensajes, el worker descarta avisos incompatibles con el estado actual de la reserva.
- Los recordatorios pendientes se refrescan cuando cambian cancha, fecha/hora o cliente, y se descartan si la reserva deja de estar confirmada.
- Si una reserva confirmada se reprograma, un recordatorio aún no enviado se vuelve a calendarizar alrededor de 24 h antes de la nueva hora de inicio; no se envía inmediatamente con la fecha antigua.
- Mensajes abandonados en `processing` solo se recuperan o descartan después de vencer el lease; los que pierden su reserva asociada se marcan `skipped` para no retener/envíar PII sin contexto.
- La entrega hacia Meta es **at-least-once**: si el proveedor acepta un mensaje pero la respuesta se pierde antes de persistir su `provider_message_id`, un reintento podría duplicarlo. No se afirma garantía exactly-once sin reconciliación adicional.
