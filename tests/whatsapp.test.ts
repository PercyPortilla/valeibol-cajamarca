import test from "node:test";
import assert from "node:assert/strict";
import { hasWhatsAppServerConfig } from "../lib/whatsapp/cloudApi.ts";

const KEYS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_TEMPLATE_OWNER_NEW_REQUEST",
  "WHATSAPP_TEMPLATE_CUSTOMER_CONFIRMED",
  "WHATSAPP_TEMPLATE_CUSTOMER_CANCELLED",
  "WHATSAPP_TEMPLATE_CUSTOMER_REMINDER",
] as const;

test("WhatsApp se considera no configurado si faltan secretos server-side", () => {
  const before = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of KEYS) delete process.env[key];
    assert.equal(hasWhatsAppServerConfig(), false);
  } finally {
    for (const key of KEYS) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
});

test("WhatsApp exige el conjunto completo de configuración", () => {
  const before = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of KEYS) process.env[key] = "configured";
    assert.equal(hasWhatsAppServerConfig(), true);
    delete process.env.WHATSAPP_TEMPLATE_CUSTOMER_REMINDER;
    assert.equal(hasWhatsAppServerConfig(), false);
  } finally {
    for (const key of KEYS) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  }
});
