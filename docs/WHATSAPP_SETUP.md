# Valeibol · WhatsApp Business Platform

La integración usa la API oficial de WhatsApp Business/Cloud API. No usa automatización de navegador ni librerías no oficiales.

## Variables server-side

Configurar únicamente en Vercel/Supabase server-side, nunca con prefijo `NEXT_PUBLIC_`:

```env
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v23.0
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

`POST /api/internal/whatsapp/process`

Requiere:

```http
Authorization: Bearer <WHATSAPP_PROCESSOR_SECRET>
```

El worker:

1. encola recordatorios debidos de forma idempotente;
2. reclama mensajes con `FOR UPDATE SKIP LOCKED`;
3. llama Meta Cloud API con templates aprobados;
4. registra `sent` o `failed`;
5. aplica backoff a fallos;
6. nunca devuelve PII en la respuesta.

Para producción, programa este endpoint desde un scheduler seguro compatible con tu plan de hosting. No expongas el secreto del procesador al navegador.

## Consentimiento

Los eventos anteriores son mensajes transaccionales de una reserva. El checkbox de marketing existente se mantiene separado para futuras campañas/promociones. Esta fase NO envía campañas masivas ni reenganche.

## Reglas de seguridad

- `anon` y `authenticated` no pueden leer `whatsapp_outbox`.
- service-role se usa solo en servidor.
- Los templates y destinatarios se derivan de datos autoritativos de PostgreSQL.
- La UI no puede decidir destinatario, template ni estado de entrega.
- Los fallos de WhatsApp no revierten ni eliminan reservas.
