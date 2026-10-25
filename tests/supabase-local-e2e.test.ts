import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const runner = readFileSync("scripts/run-supabase-local-e2e.mjs", "utf8");
const sqlRunner = readFileSync("scripts/run-supabase-sql-tests.mjs", "utf8");
const workflow = readFileSync(".github/workflows/validate.yml", "utf8");

test("B26 pins the Supabase CLI and exposes a reproducible local E2E command", () => {
  assert.equal(packageJson.devDependencies.supabase, "2.122.0");
  assert.equal(packageJson.scripts["supabase:e2e:local"], "node scripts/run-supabase-local-e2e.mjs");
  assert.equal(packageJson.scripts["supabase:test"], "node scripts/run-supabase-sql-tests.mjs");
});

test("B26 SQL runner never falls back to a linked or remote database", () => {
  assert.match(sqlRunner, /"db", "query", "--local", "--file"/);
  assert.doesNotMatch(sqlRunner, /--linked|--project-ref|--db-url/);
  assert.match(sqlRunner, /pathToFileURL\(resolve\(process\.argv\[1\]\)\)/);
  assert.match(sqlRunner, /shell: process\.platform === "win32"/);
  assert.match(runner, /"db", "reset", "--local"/);
  assert.doesNotMatch(runner, /--linked|--project-ref|--db-url/);
});

test("B26 executes the latest B20-B25 SQL contract tests", () => {
  for (const file of [
    "platform_inventory.sql",
    "platform_ownership.sql",
    "platform_operating_hours.sql",
    "platform_booking_settings.sql",
    "platform_readiness.sql",
    "platform_business_core_settings.sql",
  ]) {
    assert.match(sqlRunner, new RegExp(file.replace(".", "\\.")));
  }
});

test("CI runs the real local Supabase/Postgres E2E without remote credentials", () => {
  assert.match(workflow, /supabase-sql-e2e:/);
  assert.match(workflow, /npm run supabase:e2e:local/);
  assert.doesNotMatch(workflow, /SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|project-ref|--linked/);
});
