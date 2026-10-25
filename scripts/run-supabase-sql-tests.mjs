import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

function getProjectId() {
  const config = readFileSync("supabase/config.toml", "utf8");
  const match = config.match(/^project_id\s*=\s*"([^"]+)"/m);
  if (!match?.[1]) throw new Error("Supabase project_id is missing from supabase/config.toml");
  return match[1];
}

const dbContainer = `supabase_db_${getProjectId()}`;

function runSqlFile(file) {
  const result = spawnSync("docker", [
    "exec",
    "-i",
    dbContainer,
    "psql",
    "-X",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ], {
    cwd: process.cwd(),
    input: readFileSync(file),
    stdio: ["pipe", "inherit", "inherit"],
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`PostgreSQL SQL test failed (${result.status ?? "unknown"}): ${file}`);
  }
}

export function runSqlTests() {
  for (const file of sqlTests) {
    console.log(`\n[sql-e2e] ${file}`);
    runSqlFile(file);
  }

  console.log(`\nSupabase SQL E2E: PASS · ${sqlTests.length}/${sqlTests.length} archivos ejecutados`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSqlTests();
}
