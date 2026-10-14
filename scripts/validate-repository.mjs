import { existsSync } from "node:fs";
import { resolve } from "node:path";

const required = [
  "package-lock.json",
  "supabase/config.toml",
  "supabase/seed.sql",
  "supabase/migrations/202610140001_phase3_core.sql",
  "supabase/migrations/202610140002_phase4_public_booking.sql",
  "supabase/migrations/202610140003_phase5_admin_auth.sql",
  "supabase/migrations/202610140004_phase6_admin_operations.sql",
  "supabase/migrations/202610140005_phase7_customers_pricing_metrics.sql",
  "supabase/migrations/202610140006_phase7_production_hardening.sql",
  "supabase/migrations/202610140007_phase8_whatsapp.sql",
  "supabase/migrations/202610140008_fix_customer_phone_e164.sql",
  "supabase/migrations/202610140009_advisor_hardening.sql",
  "supabase/migrations/202610140010_move_btree_gist_extension.sql",
  "supabase/migrations/202610140011_safe_business_delete_revision.sql",
  "supabase/tests/phase3.sql",
  "supabase/tests/phase4.sql",
  "supabase/tests/phase5.sql",
  "supabase/tests/phase6.sql",
  "supabase/tests/phase7.sql",
  "supabase/tests/phase7_hardening.sql",
  "supabase/tests/phase8.sql",
  "supabase/tests/security-baseline.sql",
  "tests/availability.test.ts",
  "tests/booking.test.ts",
  "tests/admin-auth.test.ts",
  "tests/admin-operations.test.ts",
  "tests/phase7.test.ts",
  "tests/production-hardening.test.ts",
  "tests/whatsapp.test.ts",
  "scripts/validate-phase7.mjs",
  "scripts/smoke-supabase.mjs",
  "scripts/integration-phase4-concurrency.mjs",
  "scripts/integration-phase5-auth.mjs",
  "scripts/integration-phase6-concurrency.mjs",
  "scripts/validate-production-hardening.mjs",
  "scripts/validate-phase8.mjs",
  "scripts/validate-supabase-security.mjs",
  "app/api/public/reservation-requests/route.ts",
  "lib/data/supabase/service.ts",
  "lib/whatsapp/cloudApi.ts",
  "lib/whatsapp/processorAuth.ts",
  "app/api/internal/whatsapp/process/route.ts",
  "app/admin/(protected)/whatsapp/page.tsx",
  "docs/WHATSAPP_SETUP.md",
];

const missing = required.filter((path) => !existsSync(resolve(process.cwd(), path)));
if (missing.length) {
  console.error("Repository is incomplete. Missing required production artifacts:");
  for (const path of missing) console.error(` - ${path}`);
  process.exit(1);
}

console.log(`Repository completeness: ${required.length}/${required.length} required artifacts present.`);
