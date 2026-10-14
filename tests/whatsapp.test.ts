import test from "node:test";
import assert from "node:assert/strict";
import {
  hasWhatsAppServerConfig,
  normalizeWhatsAppRecipient,
  sendWhatsAppTemplate,
} from "../lib/whatsapp/cloudApi.ts";
import { isProcessorAuthorizationValid } from "../lib/whatsapp/processorAuth.ts";

const KEYS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_TEMPLATE_OWNER_NEW_REQUEST",
  "WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMED",
  "WHATSAPP_TEMPLATE_CUSTOMER_CANCELLED",
  "WHATSAPP_TEMPLATE_CUSTOMER_REMINDER",
] as const;

function preserveEnv() {
  return Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(before: Record<string, string | undefined>) {
  for (const key of KEYS) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}

function configureWhatsApp() {
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  process.env.WHATSAPP_API_VERSION = "v99.0";
  process.env.WHATSAPP_TEMPLATE_OWNER_NEW_REQUEST = "owner_request";
  process.env.WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMED = "customer_confirmed";
  process.env.WHATSAPP_TEMPLATE_CUSTOMER_CANCELLED = "customer_cancelled";
  process.env.WHATSAPP_TEMPLATE_CUSTOMER_REMINDER = "customer_reminder";
}

test("WhatsApp se considera no configurado si faltan secretos server-side", () => {
  const before = preserveEnv();
  try {
    for (const key of KEYS) delete process.env[key];
    assert.equal(hasWhatsAppServerConfig(), false);
  } finally {
    restoreEnv(before);
  }
});

test("WhatsApp exige el conjunto completo de configuración", () => {
  const before = preserveEnv();
  try {
    configureWhatsApp();
    assert.equal(hasWhatsAppServerConfig(), true);
    delete process.env.WHATSAPP_TEMPLATE_CUSTOMER_REMINDER;
    assert.equal(hasWhatsAppServerConfig(), false);
  } finally {
    restoreEnv(before);
  }
});

test("WhatsApp acepta E.164 con + y elimina solo el prefijo para Meta", () => {
  assert.equal(normalizeWhatsAppRecipient("+51911111111"), "51911111111");
  assert.equal(normalizeWhatsAppRecipient("  +51911111111  "), "51911111111");
});

test("WhatsApp rechaza destinatarios que no sean E.164", () => {
  assert.throws(() => normalizeWhatsAppRecipient("51911111111"), /Invalid WhatsApp recipient/);
  assert.throws(() => normalizeWhatsAppRecipient("+51 911 111 111"), /Invalid WhatsApp recipient/);
  assert.throws(() => normalizeWhatsAppRecipient("+00000000"), /Invalid WhatsApp recipient/);
});

test("el secreto del procesador exige Bearer exacto y comparación segura", () => {
  assert.equal(isProcessorAuthorizationValid(null, "secret"), false);
  assert.equal(isProcessorAuthorizationValid("Bearer wrong", "secret"), false);
  assert.equal(isProcessorAuthorizationValid("Basic secret", "secret"), false);
  assert.equal(isProcessorAuthorizationValid("Bearer secret", undefined), false);
  assert.equal(isProcessorAuthorizationValid("Bearer secret", " secret "), true);
});

test("Cloud API devuelve el provider_message_id y no expone token en el body", async () => {
  const before = preserveEnv();
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let authorization = "";
  let body = "";
  try {
    configureWhatsApp();
    globalThis.fetch = (async (input, init) => {
      requestUrl = String(input);
      authorization = String(init?.headers ? new Headers(init.headers).get("authorization") : "");
      body = String(init?.body ?? "");
      return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await sendWhatsAppTemplate({
      recipientE164: "+51911111111",
      templateKey: "customer_confirmed",
      variables: ["Cliente", "Valeibol"],
    });

    assert.equal(result.providerMessageId, "wamid.test");
    assert.match(requestUrl, /graph\.facebook\.com\/v99\.0\/123456\/messages$/);
    assert.equal(authorization, "Bearer test-token");
    assert.equal(body.includes("test-token"), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(before);
  }
});

test("Cloud API propaga rechazo del proveedor sin devolver PII", async () => {
  const before = preserveEnv();
  const originalFetch = globalThis.fetch;
  try {
    configureWhatsApp();
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ error: { message: "provider detail", code: 131047 } }),
      { status: 400, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

    await assert.rejects(
      () => sendWhatsAppTemplate({
        recipientE164: "+51911111111",
        templateKey: "customer_cancelled",
        variables: [],
      }),
      /WhatsApp provider rejected message \(131047\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(before);
  }
});

test("Cloud API rechaza respuesta 200 sin message id", async () => {
  const before = preserveEnv();
  const originalFetch = globalThis.fetch;
  try {
    configureWhatsApp();
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ messages: [] }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

    await assert.rejects(
      () => sendWhatsAppTemplate({
        recipientE164: "+51911111111",
        templateKey: "customer_reminder",
        variables: [],
      }),
      /returned no message id/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(before);
  }
});

test("Cloud API trata timeout/red como fallo reintentable por el outbox", async () => {
  const before = preserveEnv();
  const originalFetch = globalThis.fetch;
  try {
    configureWhatsApp();
    globalThis.fetch = (async () => {
      const timeout = new Error("request timed out");
      timeout.name = "TimeoutError";
      throw timeout;
    }) as typeof fetch;

    await assert.rejects(
      () => sendWhatsAppTemplate({
        recipientE164: "+51911111111",
        templateKey: "owner_new_request",
        variables: [],
      }),
      /request timed out/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(before);
  }
});
