export type WhatsAppTemplateKey =
  | "owner_new_request"
  | "customer_confirmed"
  | "customer_cancelled"
  | "customer_reminder";

export type SendWhatsAppTemplateInput = {
  recipientE164: string;
  templateKey: WhatsAppTemplateKey;
  variables: string[];
};

export type SendWhatsAppTemplateResult = {
  providerMessageId: string;
};

type WhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  apiVersion: string;
  language: string;
  templates: Record<WhatsAppTemplateKey, string>;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server-only WhatsApp configuration: ${name}`);
  return value;
}

function getConfig(): WhatsAppConfig {
  return {
    accessToken: required("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
    apiVersion: required("WHATSAPP_API_VERSION"),
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "es_PE",
    templates: {
      owner_new_request: required("WHATSAPP_TEMPLATE_OWNER_NEW_REQUEST"),
      customer_confirmed: required("WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMED"),
      customer_cancelled: required("WHATSAPP_TEMPLATE_CUSTOMER_CANCELLED"),
      customer_reminder: required("WHATSAPP_TEMPLATE_CUSTOMER_REMINDER"),
    },
  };
}

export function hasWhatsAppServerConfig() {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_API_VERSION &&
    process.env.WHATSAPP_TEMPLATE_OWNER_NEW_REQUEST &&
    process.env.WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMED &&
    process.env.WHATSAPP_TEMPLATE_CUSTOMER_CANCELLED &&
    process.env.WHATSAPP_TEMPLATE_CUSTOMER_REMINDER
  );
}

export function normalizeWhatsAppRecipient(value: string) {
  const normalized = value.trim();
  if (!/^[+][1-9][0-9]{7,14}$/.test(normalized)) {
    throw new Error("Invalid WhatsApp recipient.");
  }
  return normalized.slice(1);
}

export async function sendWhatsAppTemplate(
  input: SendWhatsAppTemplateInput,
): Promise<SendWhatsAppTemplateResult> {
  const config = getConfig();
  const templateName = config.templates[input.templateKey];
  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: normalizeWhatsAppRecipient(input.recipientE164),
    type: "template",
    template: {
      name: templateName,
      language: { code: config.language },
      components: input.variables.length
        ? [{
            type: "body",
            parameters: input.variables.map((text) => ({ type: "text", text: String(text).slice(0, 1024) })),
          }]
        : undefined,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await response.json().catch(() => null) as
    | { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } }
    | null;

  if (!response.ok) {
    const providerCode = payload?.error?.code ? ` (${payload.error.code})` : "";
    throw new Error(`WhatsApp provider rejected message${providerCode}.`);
  }

  const providerMessageId = payload?.messages?.[0]?.id?.trim();
  if (!providerMessageId) {
    throw new Error("WhatsApp provider returned no message id.");
  }

  return { providerMessageId };
}
