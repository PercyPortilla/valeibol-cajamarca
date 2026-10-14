import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/data/supabase/service";
import {
  hasWhatsAppServerConfig,
  sendWhatsAppTemplate,
  type WhatsAppTemplateKey,
} from "@/lib/whatsapp/cloudApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimedMessage = {
  message_id: string;
  kind: WhatsAppTemplateKey;
  recipient_e164: string;
  template_key: WhatsAppTemplateKey;
  template_variables: unknown;
  attempts: number;
};

function isAuthorized(request: NextRequest) {
  const secret = process.env.WHATSAPP_PROCESSOR_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = authorization.slice("Bearer ".length);
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length) return false;
  return timingSafeEqual(expectedBytes, suppliedBytes);
}

function variables(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").slice(0, 1024));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!hasWhatsAppServerConfig()) {
    return NextResponse.json({ error: "whatsapp_not_configured" }, { status: 503 });
  }

  const supabase = createServiceRoleSupabaseClient();

  // Idempotente: el índice (reservation_id, kind) evita duplicar recordatorios.
  const reminderQueue = await supabase.rpc("phase8_enqueue_due_reminders", {});
  if (reminderQueue.error) {
    return NextResponse.json({ error: "reminder_enqueue_failed" }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("phase8_claim_whatsapp_messages", { p_limit: 20 });
  if (error) {
    return NextResponse.json({ error: "outbox_claim_failed" }, { status: 500 });
  }

  const claimed = (data ?? []) as ClaimedMessage[];
  let sent = 0;
  let failed = 0;

  for (const message of claimed) {
    try {
      const result = await sendWhatsAppTemplate({
        recipientE164: message.recipient_e164,
        templateKey: message.template_key,
        variables: variables(message.template_variables),
      });

      const completion = await supabase.rpc("phase8_complete_whatsapp_message", {
        p_message_id: message.message_id,
        p_sent: true,
        p_provider_message_id: result.providerMessageId,
        p_error: null,
      });
      if (completion.error) throw new Error("Unable to mark WhatsApp message as sent.");
      sent += 1;
    } catch (caught) {
      failed += 1;
      const reason = caught instanceof Error ? caught.message : "Unknown WhatsApp provider error.";
      await supabase.rpc("phase8_complete_whatsapp_message", {
        p_message_id: message.message_id,
        p_sent: false,
        p_provider_message_id: null,
        p_error: reason,
      });
    }
  }

  // Nunca devolvemos teléfonos, nombres ni payloads del outbox.
  return NextResponse.json({ claimed: claimed.length, sent, failed });
}
