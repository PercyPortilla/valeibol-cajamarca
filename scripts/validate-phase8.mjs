import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migrationPath = "supabase/migrations/202610140007_phase8_whatsapp.sql";
const routePath = "app/api/internal/whatsapp/process/route.ts";
const clientPath = "lib/whatsapp/cloudApi.ts";
const authPath = "lib/whatsapp/processorAuth.ts";
const reliabilityPath = "supabase/migrations/20261023211749_block8_whatsapp_reliability.sql";
const adminReservationsPath = "app/admin/(protected)/reservas/page.tsx";

const migration = read(migrationPath);
const route = read(routePath);
const client = read(clientPath);
const auth = read(authPath);
const reliability = read(reliabilityPath);
const adminReservations = read(adminReservationsPath);

const checks = [
  ["migration exists", existsSync(resolve(root, migrationPath))],
  ["private outbox", migration.includes("whatsapp_outbox") && migration.includes("revoke all on public.whatsapp_outbox from public, anon, authenticated")],
  ["idempotent reservation event", migration.includes("whatsapp_outbox_reservation_kind_unique")],
  ["concurrent claim", migration.includes("for update skip locked")],
  ["server-only service role", route.includes("createServiceRoleSupabaseClient") && !client.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")],
  ["processor secret", route.includes("WHATSAPP_PROCESSOR_SECRET")],
  ["official Cloud API", client.includes("graph.facebook.com") && client.includes('messaging_product: "whatsapp"')],
  ["API version explicit", client.includes('required("WHATSAPP_API_VERSION")')],
  ["constant-time processor secret", auth.includes("timingSafeEqual") && route.includes("isProcessorAuthorizationValid")],
  ["E.164 literal plus", client.includes("/^[+][1-9][0-9]{7,14}$/") && migration.includes("'^[+][1-9][0-9]{7,14}$'")],
  ["stale processing recovery", migration.includes("o.status = 'processing'") && migration.includes("interval '5 minutes'")],
  ["provider id required", client.includes("returned no message id")],
  ["no PII response", route.includes("claimed: claimed.length") && !route.includes("recipient_e164, sent")],
  ["runtime template allowlist", client.includes("isWhatsAppTemplateKey") && route.includes("message.kind !== message.template_key")],
  ["cron GET support", route.includes("export const GET = processWhatsAppOutbox") && route.includes("CRON_SECRET")],
  ["stale reminder invalidation", reliability.includes("reservation_state_changed_before_delivery") && reliability.includes("customer_reminder")],
  ["stale processing state invalidation", reliability.includes("o.status = 'processing'") && reliability.includes("o.locked_at <= now() - interval '5 minutes'")],
  ["reminder reschedule", reliability.includes("greatest(now(), new.start_at - interval '24 hours')")],
  ["orphan message cleanup", reliability.includes("reservation_missing_before_delivery")],
  ["terminal stale lease cleanup", reliability.includes("processor_lease_expired_after_max_attempts")],
  ["reservation edit refresh", reliability.includes("update of status, start_at, end_at, court_id, customer_id")],
  ["admin direct WhatsApp action", adminReservations.includes("buildWhatsAppChatHref") && adminReservations.includes("Abrir chat")],
  ["persistence failures visible to scheduler", route.includes("persistenceFailures") && route.includes("status: persistenceFailures > 0 ? 500 : 200")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log(`QA Fase 8: ${checks.length}/${checks.length} PASS`);
