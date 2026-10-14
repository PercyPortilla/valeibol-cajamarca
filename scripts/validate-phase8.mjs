import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const migrationPath = "supabase/migrations/202610140007_phase8_whatsapp.sql";
const routePath = "app/api/internal/whatsapp/process/route.ts";
const clientPath = "lib/whatsapp/cloudApi.ts";

const migration = read(migrationPath);
const route = read(routePath);
const client = read(clientPath);

const checks = [
  ["migration exists", existsSync(resolve(root, migrationPath))],
  ["private outbox", migration.includes("whatsapp_outbox") && migration.includes("revoke all on public.whatsapp_outbox from public, anon, authenticated")],
  ["idempotent reservation event", migration.includes("whatsapp_outbox_reservation_kind_unique")],
  ["concurrent claim", migration.includes("for update skip locked")],
  ["server-only service role", route.includes("createServiceRoleSupabaseClient") && !client.includes("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY")],
  ["processor secret", route.includes("WHATSAPP_PROCESSOR_SECRET")],
  ["official Cloud API", client.includes("graph.facebook.com") && client.includes('messaging_product: "whatsapp"')],
  ["API version explicit", client.includes('required("WHATSAPP_API_VERSION")')],
  ["constant-time processor secret", route.includes("timingSafeEqual")],
  ["E.164 literal plus", client.includes("/^[+][1-9][0-9]{7,14}$/") && migration.includes("'^[+][1-9][0-9]{7,14}
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log(`QA Fase 8: ${checks.length}/${checks.length} PASS`);
")],
  ["stale processing recovery", migration.includes("o.status = 'processing'") && migration.includes("interval '5 minutes'")],
  ["no PII response", route.includes("claimed: claimed.length") && !route.includes("recipient_e164, sent")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} · ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
console.log(`QA Fase 8: ${checks.length}/${checks.length} PASS`);
