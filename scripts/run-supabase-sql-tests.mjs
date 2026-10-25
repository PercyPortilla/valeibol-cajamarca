import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const sqlTests = [
  "supabase/tests/phase3.sql",
  "supabase/tests/phase4.sql",
  "supabase/tests/phase5.sql",
  "supabase/tests/phase6.sql",
  "supabase/tests/phase7.sql",
  "supabase/tests/phase7_hardening.sql",
  "supabase/tests/security-baseline.sql",
  "supabase/tests/phase8.sql",
  "supabase/tests/booking_rules_net_height.sql",
  "supabase/tests/global_multitenant.sql",
  "supabase/tests/multi_sport_booking.sql",
  "supabase/tests/customer_accounts.sql",
  "supabase/tests/manual_payments.sql",
  "supabase/tests/platform_admin.sql",
  "supabase/tests/platform_engagement.sql",
  "supabase/tests/platform_inventory.sql",
  "supabase/tests/platform_ownership.sql",
  "supabase/tests/platform_operating_hours.sql",
  "supabase/tests/platform_booking_settings.sql",
  "supabase/tests/platform_readiness.sql",
  "supabase/tests/platform_business_core_settings.sql",
  "supabase/tests/platform_dynamic_sports.sql",
];

const supabaseBin = process.platform === "win32" ? "supabase.cmd" : "supabase";

function run(args) {
  const result = spawnSync(supabaseBin, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Supabase CLI failed (${result.status ?? "unknown"}): ${args.join(" ")}`);
  }
}

export function runSqlTests() {
  for (const file of sqlTests) {
    console.log(`\n[sql-e2e] ${file}`);
    run(["db", "query", "--local", "--file", file]);
  }

  console.log(`\nSupabase SQL E2E: PASS · ${sqlTests.length}/${sqlTests.length} archivos ejecutados`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSqlTests();
}
