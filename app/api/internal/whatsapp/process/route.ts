import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/data/supabase/service";
import { isProcessorAuthorizationValid } from "@/lib/whatsapp/processorAuth";
import {
  hasWhatsAppServerConfig,
  isWhatsAppTemplateKey,
  sendWhatsAppTemplate,
} from "@/lib/whatsapp/cloudApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClaimedMessage = {
  message_id: string;
  kind: unknown;
  recipient_e164: string;
  template_key: unknown;
  template_variables: unknown;
  attempts: number;
};

function variables(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").slice(0, 1024));
}

function isProcessorRequestAuthorized(authorization: string | null) {
  return isProcessorAuthorizationValid(authorization, process.env.WHATSAPP_PROCESSOR_SECRET)
    || isProcessorAuthorizationValid(authorization, process.env.CRON_SECRET);
}

async function processWhatsAppOutbox(request: NextRequest) {
  if (!isProcessorRequestAuthorized(request.headers.get("authorization"))) {
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
  let persistenceFailures = 0;

  for (const message of claimed) {
    if (
      !isWhatsAppTemplateKey(message.kind) ||
      !isWhatsAppTemplateKey(message.template_key) ||
      message.kind !== message.template_key
    ) {
      const completion = await supabase.rpc("phase8_complete_whatsapp_message", {
        p_message_id: message.message_id,
        p_sent: false,
        p_provider_message_id: null,
        p_error: "invalid_whatsapp_template_key",
      });
      if (completion.error) persistenceFailures += 1;
      else failed += 1;
      continue;
    }

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
      if (completion.error) persistenceFailures += 1;
      else sent += 1;
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "Unknown WhatsApp provider error.";
      const completion = await supabase.rpc("phase8_complete_whatsapp_message", {
        p_message_id: message.message_id,
        p_sent: false,
        p_provider_message_id: null,
        p_error: reason,
      });
      if (completion.error) persistenceFailures += 1;
      else failed += 1;
    }
  }

  // Nunca devolvemos teléfonos, nombres ni payloads del outbox.
  return NextResponse.json(
    { claimed: claimed.length, sent, failed, persistenceFailures },
    { status: persistenceFailures > 0 ? 500 : 200 },
  );
}

export const POST = processWhatsAppOutbox;
export const GET = processWhatsAppOutbox;
